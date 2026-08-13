/**
 * Background review-job producer for `/review <pr>`.
 *
 * The job reads the PR diff (capped by config), runs the deterministic
 * multi-file analyzer, and stores the report in the plugin's in-memory record
 * map. Completion notices are delivered by the host's tool-jobs consumer
 * (followup for an idle owner, inject for a busy one); the model then reads
 * the report with the existing job_output tool and posts it with review_post
 * after approval. The job itself never writes to GitHub.
 * @module dsh-github/jobs
 */
import { analyzeDiff, type ReviewReport } from './review.ts'
import type { GithubAgent, GithubJobId, JobOutcome, JobRegistry, JobStartSpec } from './types.ts'
import type { GithubState, ReviewJobRecord } from './state.ts'

/** Producer kind — also the `<kind>-N` id prefix; the host treats it as opaque. */
export const REVIEW_JOB_KIND = 'github-review'

export interface StartReviewJobInput {
  repo: string
  pr: number
  label: string
  owner: GithubAgent
  /** Present in tests where no job registry exists; disables registration. */
  timeoutMs?: number
}

/**
 * Start one background review job and register its in-memory record.
 *
 * The token is resolved inside the run body (per-operation, per the
 * credentials-seam contract); a missing token settles the job as `failed`
 * with configuration guidance, never with a token value.
 * @param registry - `ctx.jobs` of the hosting context.
 * @param state - plugin state holding config, token resolution, and records.
 * @param input - target PR, label, and owning agent.
 * @returns the registry-issued `<kind>-N` id.
 */
export function startReviewJob(registry: JobRegistry, state: GithubState, input: StartReviewJobInput): GithubJobId {
  const record: ReviewJobRecord = {
    status: 'running',
    repo: input.repo,
    pr: input.pr,
    report: null,
  }

  const spec: JobStartSpec = {
    kind: REVIEW_JOB_KIND,
    label: input.label,
    owner: input.owner,
    outputLimitBytes: 64 * 1024,
    run: () => runReviewWork(state, record, input.timeoutMs ?? state.config.reviewJobTimeoutMs),
  }

  const id = registry.start(spec)
  state.records.set(id, record)
  return id
}

/** Run the review work and settle exactly one terminal outcome. */
function runReviewWork(state: GithubState, record: ReviewJobRecord, timeoutMs: number): { cancel: (reason?: string) => void; done: Promise<JobOutcome> } {
  const controller = new AbortController()
  let cancelReason: string | undefined

  const timer = setTimeout(() => {
    cancelReason ??= 'timeout'
    controller.abort(new Error('review job timed out'))
  }, timeoutMs)

  const done = (async (): Promise<JobOutcome> => {
    try {
      const token = await state.resolveToken(controller.signal)
      const abortedAfterToken = abortedOutcome(controller, cancelReason)
      if (abortedAfterToken !== null) {
        record.status = abortedAfterToken.status === 'killed' ? 'killed' : 'failed'
        return abortedAfterToken
      }
      if (!token.ok) {
        record.status = 'failed'
        record.error = token.error.message
        return { status: 'failed', detail: 'no GitHub token', output: `${token.error.message}\n${token.error.guidance}` }
      }
      const client = state.client(token.token.value)
      const diff = await client.requestText('GET', `/repos/${record.repo}/pulls/${record.pr}`, { signal: controller.signal })
      const abortedAfterDiff = abortedOutcome(controller, cancelReason)
      if (abortedAfterDiff !== null) {
        record.status = abortedAfterDiff.status === 'killed' ? 'killed' : 'failed'
        return abortedAfterDiff
      }
      const capped = diff.text.length > state.config.maxDiffChars ? diff.text.slice(0, state.config.maxDiffChars) : diff.text
      const report: ReviewReport = analyzeDiff(capped, state.config.maxDiffChars)
      record.report = report
      record.status = 'completed'
      return { status: 'completed', detail: `${report.findings.length} finding(s)`, output: report.summary }
    } catch (error) {
      const aborted = abortedOutcome(controller, cancelReason)
      if (aborted !== null) {
        record.status = aborted.status === 'killed' ? 'killed' : 'failed'
        return aborted
      }
      record.status = 'failed'
      const message = error instanceof Error ? error.message : 'review failed'
      record.error = message
      return { status: 'failed', detail: message }
    } finally {
      clearTimeout(timer)
    }
  })()

  return {
    cancel: (reason?: string) => {
      cancelReason = reason ?? 'cancelled'
      controller.abort()
    },
    done,
  }
}

/** Terminal outcome for an aborted controller; null while still running. */
function abortedOutcome(controller: AbortController, cancelReason: string | undefined): JobOutcome | null {
  if (!controller.signal.aborted) return null
  if (cancelReason === 'timeout') {
    return { status: 'failed', detail: 'timeout' }
  }
  if (cancelReason !== undefined) {
    return { status: 'killed', detail: cancelReason }
  }
  return { status: 'failed', detail: 'aborted' }
}
