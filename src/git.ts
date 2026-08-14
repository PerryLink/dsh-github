/**
 * Read-only git workspace inspection for `/pr create` drafts.
 *
 * The plugin never commits, pushes, or rewrites git identity — dsh-git-identity
 * and the model's own bash calls own those writes. Everything here is a read.
 * @module dsh-github/git
 */
import { execFile } from 'node:child_process'

/** Runs one git command with stdout captured; injectable for tests. */
export type GitRunner = (args: string[], options: { cwd: string; signal?: AbortSignal }) => Promise<{ stdout: string }>

/** Read-only snapshot of the git state a PR draft needs. */
export interface GitState {
  /** Current branch, or null outside a repository. */
  branch: string | null
  /** Whether the working tree has uncommitted changes. */
  hasChanges: boolean
  /** Porcelain status lines, capped. */
  changedFiles: string[]
  /** Oneline log of commits ahead of the upstream (or the latest commits). */
  commitsAhead: string[]
  /** `origin` remote URL, when configured. */
  remote: string | null
  /** `owner/repo` parsed from the origin URL, when parseable. */
  repoFromRemote: string | null
  /** First read failure that stopped collection; the rest stays partial. */
  error?: string
}

const MAX_CHANGED_FILES = 50
const MAX_COMMITS = 20

/** Run the real git CLI with stdout captured (never logged). */
export function runGitCli(args: string[], options: { cwd: string; signal?: AbortSignal }): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: options.cwd, windowsHide: true, signal: options.signal, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error)
      else resolve({ stdout })
    })
  })
}

/**
 * Parse `owner/repo` out of common origin URL forms (https, ssh, git), for any
 * GitHub host. The host must match `apiHost` (the configured REST base's
 * hostname; `github.com` by default), so a GitHub Enterprise checkout resolves
 * against its own API without accepting an unrelated host.
 * @param remote - raw `git remote get-url origin` output.
 * @param apiHost - expected hostname (lowercased), e.g. `github.com` or `git.example.com`.
 * @returns `owner/repo`, or null when the URL is unparseable or foreign.
 */
export function repoFromRemoteUrl(remote: string, apiHost = 'github.com'): string | null {
  const trimmed = remote.trim()
  const match = /^(?:https?:\/\/|ssh:\/\/git@|git:\/\/|git@)?([^/:]+)(?::\d+)?[:/]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(trimmed)
  if (match === null) return null
  const host = (match[1] ?? '').toLowerCase()
  return host === apiHost.toLowerCase() ? (match[2] ?? null) : null
}

/**
 * Collect the read-only git facts a PR draft needs, tolerating partial
 * failures: each command that fails records `error` and stops collection.
 * @param cwd - repository working directory.
 * @param runGit - git CLI runner; the real one by default.
 * @param signal - cancels collection.
 * @param apiHost - expected origin host for `owner/repo` parsing (`github.com` by default).
 * @returns the collected snapshot.
 */
export async function readGitState(cwd: string, runGit: GitRunner = runGitCli, signal?: AbortSignal, apiHost = 'github.com'): Promise<GitState> {
  const state: GitState = {
    branch: null,
    hasChanges: false,
    changedFiles: [],
    commitsAhead: [],
    remote: null,
    repoFromRemote: null,
  }

  try {
    const { stdout } = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, signal })
    state.branch = stdout.trim() || null
  } catch (error) {
    state.error = describeError(error)
    return state
  }

  try {
    const { stdout } = await runGit(['status', '--porcelain=v1'], { cwd, signal })
    const lines = stdout.split(/\r?\n/).filter(line => line.length > 0)
    state.changedFiles = lines.slice(0, MAX_CHANGED_FILES)
    state.hasChanges = lines.length > 0
  } catch (error) {
    state.error = describeError(error)
    return state
  }

  try {
    const { stdout } = await runGit(['log', '--oneline', '-n', String(MAX_COMMITS), '@{upstream}..HEAD'], { cwd, signal })
    state.commitsAhead = stdout.split(/\r?\n/).filter(line => line.length > 0)
  } catch {
    // No upstream configured: list the latest local commits instead.
    try {
      const { stdout } = await runGit(['log', '--oneline', '-n', String(MAX_COMMITS), 'HEAD'], { cwd, signal })
      state.commitsAhead = stdout.split(/\r?\n/).filter(line => line.length > 0)
    } catch (error) {
      state.error = describeError(error)
      return state
    }
  }

  try {
    const { stdout } = await runGit(['remote', 'get-url', 'origin'], { cwd, signal })
    const remote = stdout.trim()
    if (remote.length > 0) {
      state.remote = remote
      state.repoFromRemote = repoFromRemoteUrl(remote, apiHost)
    }
  } catch {
    // No origin remote: leave remote facts absent.
  }

  return state
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('not a git repository')) return 'not a git repository'
    if (error.message.includes('ENOENT')) return 'git CLI not available'
    return error.message
  }
  return 'git read failed'
}
