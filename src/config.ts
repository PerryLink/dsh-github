/**
 * Schemastery configuration for dsh-github.
 *
 * Every tunable is changeable from cordis.yml; the schema validates at load
 * time and fails loud on invalid values. Secrets are NOT config fields: the
 * token always travels through the credentials seam (a reference name here,
 * never a value).
 * @module dsh-github/config
 */
import z from '@deepseek-ai/schemastery'

/** GitHub write actions the plugin may perform (each still requires approval). */
export type GithubAction = 'pr.create' | 'review.post' | 'issue.create' | 'issue.comment' | 'issue.close'

/** Where a GitHub token is looked up. `auto` tries them in order. */
export type TokenSource = 'auto' | 'credentials' | 'env' | 'gh'

export interface Config {
  /**
   * Token lookup order: `auto` resolves credentials-seam reference → `env`
   * variable → `gh` CLI login, in that order. Explicit values restrict to one
   * source and report a structured error when it is unavailable.
   */
  tokenSource: TokenSource
  /** Credentials-seam reference / environment-variable name for the token. */
  tokenRef: string
  /** `owner/repo` used when a call does not name one and git has no origin. */
  defaultOwnerRepo?: string
  /** Whether `/pr create` may instruct the model to commit and push first. */
  autoCommit: boolean
  /** Character cap for PR diffs read into a review (diff or review job). */
  maxDiffChars: number
  /** Character cap for the diff excerpt rendered into tool output. */
  renderExcerptChars: number
  /** Cap for PR comments listed by gh_review. */
  maxComments: number
  /** Deadline for one background review job; exceeded jobs fail with detail. */
  reviewJobTimeoutMs: number
  /** Cap for in-memory review-job records; oldest settled records evict first. */
  maxReviewRecords: number
  /**
   * Review engine: `static` runs the deterministic analyzer; `model` delegates
   * the capped diff to a one-shot subagent through the host's `subagents` seam
   * (the owner agent is the parent). Fails loud when the seam is absent.
   */
  reviewMode: 'static' | 'model'
  /** Subagent provider name for `reviewMode: "model"`; defaults to the first registered. */
  modelReviewProvider?: string
  /** Maximum 429 retry attempts per GitHub API request. */
  maxRetries: number
  /** Base backoff for 429 retries (doubles per attempt). */
  retryBaseMs: number
  /** Ceiling for 429 retry backoff. */
  retryMaxWaitMs: number
  /** GitHub REST base URL; change for GitHub Enterprise. */
  apiBaseUrl: string
  /** Whitelist of write actions; everything else is denied before approval. */
  allowedActions: GithubAction[]
  /** Working directory for read-only git inspection; defaults to the process cwd. */
  workspaceDir?: string
}

const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

export const Config: z<Config> = z.object({
  tokenSource: z.union(['auto', 'credentials', 'env', 'gh'] as const)
    .default('auto')
    .description('Token lookup source: auto tries credentials → env → gh in order.'),
  tokenRef: z.string()
    .pattern(/^[A-Za-z_][A-Za-z0-9_]*$/)
    .default('GITHUB_TOKEN')
    .description('Credential reference / environment variable name holding the token.'),
  defaultOwnerRepo: z.string()
    .pattern(OWNER_REPO_PATTERN)
    .description('Fallback owner/repo when neither the call nor git names one.'),
  autoCommit: z.boolean()
    .default(false)
    .description('Whether /pr create may instruct the model to commit and push first.'),
  maxDiffChars: z.number().step(1).min(1)
    .default(8000)
    .description('Character cap for PR diffs read into a review.'),
  renderExcerptChars: z.number().step(1).min(1)
    .default(2000)
    .description('Character cap for the diff excerpt rendered into tool output.'),
  maxComments: z.number().step(1).min(1)
    .default(20)
    .description('Cap for PR comments listed by gh_review.'),
  reviewJobTimeoutMs: z.number().step(1).min(1000)
    .default(600_000)
    .description('Deadline for one background review job.'),
  maxReviewRecords: z.number().step(1).min(1)
    .default(50)
    .description('Cap for in-memory review-job records; oldest settled records evict first.'),
  reviewMode: z.union(['static', 'model'] as const)
    .default('static')
    .description('Review engine: static (deterministic analyzer) or model (one-shot subagent through the subagents seam).'),
  modelReviewProvider: z.string()
    .description('Subagent provider name for model review; defaults to the first registered provider.'),
  maxRetries: z.number().step(1).min(0)
    .default(3)
    .description('Maximum 429 retry attempts per GitHub API request.'),
  retryBaseMs: z.number().step(1).min(1)
    .default(500)
    .description('Base backoff for 429 retries (doubles per attempt).'),
  retryMaxWaitMs: z.number().step(1).min(1)
    .default(60_000)
    .description('Ceiling for 429 retry backoff.'),
  apiBaseUrl: z.string()
    .default('https://api.github.com')
    .description('GitHub REST base URL (change for GitHub Enterprise).'),
  allowedActions: z.array(z.union(['pr.create', 'review.post', 'issue.create', 'issue.comment', 'issue.close'] as const))
    .default(['pr.create', 'review.post', 'issue.create', 'issue.comment', 'issue.close'])
    .description('Write actions this plugin may perform; each still requires approval.'),
  workspaceDir: z.string()
    .description('Working directory for read-only git inspection (defaults to process cwd).'),
})
