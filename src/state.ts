/**
 * Shared per-plugin-instance state handed to tools, commands, and the review
 * job: configuration, the credentials seam, the in-memory review-job records,
 * and repo / PR-reference resolution helpers.
 *
 * The records map is the only mutable state; it lives exactly as long as the
 * plugin fiber, mirroring the process-local lifetime of the host job registry,
 * and is capped by `maxReviewRecords` (oldest settled records evict first).
 * @module dsh-github/state
 */
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { GithubClient, clientOptionsFromConfig, type RateLimitInfo } from './github.ts'
import { repoFromRemoteUrl, type GitRunner } from './git.ts'
import { resolveToken, type GhRunner, type TokenResolution } from './credential.ts'
import type { SubagentsService } from './types.ts'
import type { ReviewReport } from './review.ts'
import type { Config } from './config.ts'

/** Result of resolving which repository a call targets. */
export type RepoResolution = { ok: true; repo: string } | { ok: false; code: string; message: string; guidance: string }

/** A parsed PR reference: repository (when explicit) plus the PR number. */
export interface PrRef {
  number: number
  /** `owner/repo` when the reference names one explicitly. */
  repo?: string
}

/** In-memory record of one background review job, keyed by job id. */
export interface ReviewJobRecord {
  status: 'running' | 'completed' | 'failed' | 'killed'
  repo: string
  pr: number
  /** Head-commit SHA of the reviewed PR, captured for inline review posting. */
  headSha?: string
  /** One-line CI check summary captured by the job (when requested). */
  ciSummary?: string
  /** Count of existing review comments captured by the job (when requested). */
  commentsCount?: number
  report: ReviewReport | null
  error?: string
}

export interface GithubState {
  config: Config
  credentials: CredentialProvider
  /** Host subagent seam; present when composed (used by model review). */
  subagents?: SubagentsService
  records: Map<string, ReviewJobRecord>
  /** Read-only git runner (injectable in tests). */
  runGit: GitRunner
  /** gh CLI runner (injectable in tests). */
  runGh: GhRunner
  /** Resolves the token per operation; never cached across operations. */
  resolveToken(signal?: AbortSignal): Promise<TokenResolution>
  /** Builds an authenticated client for one operation. */
  client(token: string): GithubClient
  /** Resolves `owner/repo` from an explicit value, config, or git origin. */
  resolveRepo(ownerRepo: string | undefined, signal?: AbortSignal): Promise<RepoResolution>
  /** Parses `123`, `#123`, `owner/repo#123`, or a pull-request URL. */
  parsePrRef(input: string): PrRef | null
  /** Working directory for git inspection. */
  workspaceDir: string
  /** Hostname of the configured REST API base, for origin-URL matching. */
  apiHost: string
  /** Register one review-job record, evicting settled records past the cap. */
  rememberRecord(id: string, record: ReviewJobRecord): void
}

const REPO_GUIDANCE = 'Name the repository with the ownerRepo parameter, set defaultOwnerRepo in cordis.yml, or run inside a checkout with a GitHub origin remote.'

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

/**
 * Create the shared plugin state. Called once per plugin instance (per
 * cordis.yml row); config hot-reload creates a fresh instance.
 * @param ctx - context holding the credentials seam and (optionally) the subagent seam.
 * @param config - validated configuration.
 * @param runGit - read-only git runner (injectable in tests).
 * @param runGh - gh CLI runner (injectable in tests).
 * @param fetchImpl - fetch implementation (injectable in tests).
 */
export function createState(ctx: { credentials: CredentialProvider; subagents?: SubagentsService }, config: Config, runGit: GitRunner, runGh: GhRunner, fetchImpl?: typeof fetch): GithubState {
  const clientOptions = clientOptionsFromConfig(config, fetchImpl)
  const apiHost = new URL(config.apiBaseUrl).hostname.toLowerCase()
  const records = new Map<string, ReviewJobRecord>()
  const state: GithubState = {
    config,
    credentials: ctx.credentials,
    subagents: ctx.subagents,
    records,
    runGit,
    runGh,
    workspaceDir: config.workspaceDir ?? process.cwd(),
    apiHost,
    resolveToken: (signal?: AbortSignal) => resolveToken(ctx.credentials, config.tokenSource, config.tokenRef, runGh, signal),
    client: (token: string) => new GithubClient(token, clientOptions),
    resolveRepo: (ownerRepo: string | undefined, signal?: AbortSignal) => resolveRepo(state, ownerRepo, signal),
    parsePrRef: parsePrRef,
    rememberRecord: (id, record) => {
      records.set(id, record)
      while (records.size > config.maxReviewRecords) {
        const oldestSettled = [...records.entries()].find(([, item]) => item.status !== 'running')
        if (oldestSettled === undefined) break // every record is running; the cap is best-effort.
        records.delete(oldestSettled[0])
      }
    },
  }
  return state
}

/** Resolve the target repository: explicit value → config fallback → git origin. */
export async function resolveRepo(state: GithubState, ownerRepo: string | undefined, signal?: AbortSignal): Promise<RepoResolution> {
  const candidate = ownerRepo?.trim()
  if (candidate !== undefined && candidate.length > 0) {
    return REPO_PATTERN.test(candidate)
      ? { ok: true, repo: candidate }
      : { ok: false, code: 'invalid-repo', message: `"${candidate}" is not an owner/repo pair`, guidance: REPO_GUIDANCE }
  }
  const fallback = state.config.defaultOwnerRepo?.trim()
  if (fallback !== undefined && fallback.length > 0) return { ok: true, repo: fallback }
  const { repoFromRemote } = await runGitRemote(state, state.workspaceDir, signal)
  if (repoFromRemote !== null) return { ok: true, repo: repoFromRemote }
  return { ok: false, code: 'repo-unknown', message: 'could not determine the target repository', guidance: REPO_GUIDANCE }
}

/** Structural subset of GithubState used by {@link resolveRepo}. */
interface RepoStateView {
  config: Config
  runGit: GitRunner
  workspaceDir: string
  apiHost: string
}

/** Parses PR references: `123`, `#123`, `owner/repo#123`, or a pull URL. */
export function parsePrRef(input: string): PrRef | null {
  const trimmed = input.trim()
  const urlMatch = /^https?:\/\/[^/]+\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/pull\/(\d+)\/?$/.exec(trimmed)
  if (urlMatch) return { number: Number(urlMatch[2]), repo: urlMatch[1] }
  const hashMatch = /^(?:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+))?#(\d+)$/.exec(trimmed)
  if (hashMatch) return hashMatch[1] === undefined ? { number: Number(hashMatch[2]) } : { number: Number(hashMatch[2]), repo: hashMatch[1] }
  if (/^\d+$/.test(trimmed)) return { number: Number(trimmed) }
  return null
}

/** Read the git origin URL through the injected runner. */
async function runGitRemote(this: void, state: RepoStateView, cwd: string, signal?: AbortSignal): Promise<{ repoFromRemote: string | null }> {
  try {
    const { stdout } = await state.runGit(['remote', 'get-url', 'origin'], { cwd, signal })
    return { repoFromRemote: repoFromRemoteUrl(stdout, state.apiHost) }
  } catch {
    return { repoFromRemote: null }
  }
}

/** Shared shape of rate-limit facts on tool results. */
export type RateLimitValue = {
  remaining: number | null
  resetAt: number | null
}

export function rateLimitValue(info: RateLimitInfo): RateLimitValue {
  return { remaining: info.remaining, resetAt: info.resetAt }
}
