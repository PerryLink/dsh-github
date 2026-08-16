/**
 * The CI review pipeline — one deterministic pass over a pull request,
 * shared by the polling bot, the `/ci run` command, and the one-shot
 * `ci_run` tool used by the composite action's headless session.
 *
 * Order of operations: resolve the token → fetch PR metadata (head SHA,
 * labels, totals) → apply label/path filters → idempotency checks (completed
 * check run with our name, and the review-body marker) → fetch the capped
 * diff and changed-file list → run the deterministic analyzers (line rules
 * from src/review.ts, PR-level rules from ./review-rules.ts) → post inline
 * review comments → publish the status check (success / failure / neutral
 * per `ci.blocking`) → write `dsh-github-ci-result.json` and
 * `dsh-github-ci-summary.md` (+ `$GITHUB_OUTPUT` lines when present).
 *
 * Token discipline matches the rest of the plugin: the value is resolved per
 * operation and handed only to the REST client — never into findings,
 * reports, check output, or thrown messages.
 * @module dsh-github/ci/pipeline
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Finding } from '../review.ts'
import { analyzeDiff, sanitizeFileName } from '../review.ts'
import { analyzePr, matchesAnyGlob, type ChangedFileStat } from './review-rules.ts'
import { rateLimitValue, type GithubState, type RateLimitValue } from '../state.ts'

/** The gate verdict: pass, needs changes, or skipped by the filters. */
export type CiVerdict = 'pass' | 'needs-changes' | 'skipped'

/** Tasks the pipeline (and the `ci_run` tool) understands. */
export type CiTask = 'review' | 'analyze' | 'publish'

export interface CheckRunValue {
  id: number
  url: string
  conclusion: string
}

export interface ReviewPostValue {
  url: string
  inlineComments: number
}

/** Successful pipeline result — the canonical JSON the `ci_run` tool returns. */
export interface CiRunResult {
  status: 'ok'
  repo: string
  pr: number
  headSha: string
  verdict: CiVerdict
  engine: 'static' | 'model'
  findings: Finding[]
  summary: string
  truncated: boolean
  /** A previous run for this head commit already published its outcome. */
  alreadyReviewed: boolean
  /** Present when the diff text was requested (analyze task). */
  diffText?: string
  checkRun?: CheckRunValue
  review?: ReviewPostValue
  files?: { json: string; markdown: string }
  rateLimit: RateLimitValue
}

/** Structured failure — token-free by construction. */
export interface CiRunError {
  status: 'error'
  code: string
  message: string
  guidance?: string
  rateLimit?: RateLimitValue
}

export type CiRunOutcome = CiRunResult | CiRunError

export interface CiRunOptions {
  repo: string
  pr: number
  task: CiTask
  /** Diff cap for this run; defaults to the plugin config. */
  maxDiffChars?: number
  /** Review-body override (model-authored, publish task). */
  body?: string
  /** Extra findings authored by the model (publish task); merged with static ones. */
  findings?: Finding[]
  /** Post review comments; defaults to `ci.postComments`. */
  postComments?: boolean
  /** Publish the status check; defaults to true for review/publish. */
  postCheck?: boolean
  signal?: AbortSignal
}

interface PullMetaPayload {
  number?: number
  title?: string
  state?: string
  html_url?: string
  additions?: number
  deletions?: number
  draft?: boolean
  labels?: Array<{ name?: string }>
  head?: { ref?: string; sha?: string } | null
  base?: { ref?: string } | null
}

interface FileEntryPayload {
  filename?: string
  additions?: number
  deletions?: number
}

interface CheckRunPayload {
  id?: number
  name?: string
  status?: string
  conclusion?: string | null
  html_url?: string
}

interface ReviewPayload {
  id?: number
  body?: string
  html_url?: string
}

/** First line of the review body — the idempotency marker. */
export function reviewMarker(headSha: string): string {
  return `<!-- dsh-github-review:${headSha} -->`
}

/** Whether a review body carries our marker for the given head commit. */
export function hasReviewMarker(body: string | undefined, headSha: string): boolean {
  return body !== undefined && body.includes(reviewMarker(headSha))
}

/** A review-timeout signal combining the caller's and the configured deadline. */
function timeoutSignal(state: GithubState, signal?: AbortSignal): AbortSignal {
  const deadline = AbortSignal.timeout(state.config.requestTimeoutMs)
  return signal === undefined ? deadline : AbortSignal.any([signal, deadline])
}

/** Conclude the verdict from the findings under the configured `failOn` policy. */
export function verdictFor(findings: readonly Finding[], failOn: 'error' | 'warning'): CiVerdict {
  const severity = (finding: Finding): number => finding.severity === 'error' ? 2 : finding.severity === 'warning' ? 1 : 0
  const threshold = failOn === 'warning' ? 1 : 2
  return findings.some(finding => severity(finding) >= threshold) ? 'needs-changes' : 'pass'
}

/** Merge model-authored findings into the static set, deduping by file+line+rule. */
function mergeFindings(staticFindings: readonly Finding[], extra: readonly Finding[]): Finding[] {
  const seen = new Set<string>()
  const merged: Finding[] = []
  for (const finding of [...staticFindings, ...extra]) {
    const key = `${finding.file}\u0000${finding.line ?? ''}\u0000${finding.rule}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push({ ...finding })
  }
  return merged
}

/** Summary line for a finished pass. */
function summarize(verdict: CiVerdict, findings: readonly Finding[], truncated: boolean): string {
  const counts = (severity: Finding['severity']): number => findings.filter(finding => finding.severity === severity).length
  if (verdict === 'skipped') return 'skipped: no label/path filter match'
  return `verdict ${verdict}: ${findings.length} finding(s) (${counts('error')} error / ${counts('warning')} warning / ${counts('info')} info)${truncated ? ' (diff truncated)' : ''}`
}

/** Markdown report body written next to the JSON result. */
export function formatMarkdownReport(result: CiRunResult, options: { blocking: boolean; checkName: string }): string {
  const lines = [
    `# dsh-github CI review — PR #${result.pr} (${result.repo})`,
    '',
    `Verdict: **${result.verdict}**${result.verdict === 'needs-changes' ? ` (${options.blocking ? 'blocking' : 'non-blocking'})` : ''}${result.alreadyReviewed ? ' — already reviewed at this head commit' : ''}`,
    '',
  ]
  if (result.checkRun !== undefined) lines.push(`Check: [${options.checkName}](${result.checkRun.url}) — conclusion \`${result.checkRun.conclusion}\``, '')
  if (result.review !== undefined) lines.push(`Review: ${result.review.url} (${result.review.inlineComments} inline comment(s))`, '')
  if (result.findings.length === 0) {
    lines.push('No findings.', '')
  } else {
    lines.push(`## Findings (${result.findings.length})`, '')
    for (const finding of result.findings) {
      const anchor = finding.file.length === 0 ? 'PR' : `\`${sanitizeFileName(finding.file)}\`${finding.line !== null ? `:${finding.line}` : ''}`
      lines.push(`- **${finding.severity}** \`${finding.rule}\` ${anchor}: ${finding.message}`)
    }
    lines.push('')
  }
  if (result.truncated) lines.push('> Note: the diff exceeded the cap and was truncated; this report covers only the examined range.', '')
  lines.push('*Generated by [dsh-github](https://github.com/PerryLink/dsh-github) CI.*')
  return lines.join('\n')
}

/** Directory the report files land in: env var → config → workspace dir. */
function reportDirectory(state: GithubState): string {
  const fromEnv = process.env.DSH_GITHUB_CI_OUTPUT_DIR?.trim()
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv
  if (state.config.ci.reportDir.trim().length > 0) return state.config.ci.reportDir
  return state.workspaceDir
}

/** Write the JSON + Markdown reports and, when present, `$GITHUB_OUTPUT` lines. */
function writeReports(state: GithubState, result: CiRunResult): { json: string; markdown: string } {
  const dir = reportDirectory(state)
  mkdirSync(dir, { recursive: true })
  const jsonPath = join(dir, 'dsh-github-ci-result.json')
  const markdownPath = join(dir, 'dsh-github-ci-summary.md')
  writeFileSync(jsonPath, JSON.stringify({ schemaVersion: 1, ...result, files: { json: jsonPath, markdown: markdownPath } }, null, 2) + '\n')
  writeFileSync(markdownPath, formatMarkdownReport(result, { blocking: state.config.ci.blocking, checkName: state.config.ci.checkName }) + '\n')
  const outputFile = process.env.GITHUB_OUTPUT
  if (outputFile !== undefined && outputFile.length > 0) {
    appendFileSync(outputFile,
      `verdict=${result.verdict}\n`
      + `report-json=${jsonPath}\n`
      + `report-markdown=${markdownPath}\n`
      + `${result.checkRun !== undefined ? `check-url=${result.checkRun.url}\n` : ''}`)
  }
  return { json: jsonPath, markdown: markdownPath }
}

/** The published review body: marker, PR-level findings, and (optionally) the model override. */
function buildReviewBody(headSha: string, prFindings: readonly Finding[], override: string | undefined, truncated: boolean): string {
  const sections: string[] = [reviewMarker(headSha), '## dsh-github review']
  if (prFindings.length > 0) {
    sections.push('')
    for (const finding of prFindings) {
      const anchor = finding.file.length === 0 ? 'PR' : `\`${sanitizeFileName(finding.file)}\``
      sections.push(`- **${finding.severity}** \`${finding.rule}\` ${anchor}: ${finding.message}`)
    }
  }
  if (override !== undefined && override.trim().length > 0) {
    sections.push('', '## Review', '', override.trim())
  }
  if (truncated) sections.push('', '> Note: the diff exceeded the cap and was truncated; this report covers only the examined range.')
  return sections.join('\n')
}

/**
 * Run one CI pass over a pull request. Pure in the sense that every GitHub
 * interaction goes through the per-operation token and the shared client;
 * callers (bot, tool) own their own concurrency control.
 * @param state - shared plugin state.
 * @param options - target repo/PR, task, caps, and overrides.
 * @returns the structured outcome; failures are token-free error variants.
 */
export async function runCiPipeline(state: GithubState, options: CiRunOptions): Promise<CiRunOutcome> {
  const signal = timeoutSignal(state, options.signal)
  const maxDiffChars = options.maxDiffChars !== undefined && options.maxDiffChars > 0 ? Math.floor(options.maxDiffChars) : state.config.maxDiffChars
  const postComments = options.task !== 'analyze' && (options.postComments ?? state.config.ci.postComments)
  const postCheck = options.task !== 'analyze' && (options.postCheck ?? true)

  const token = await state.resolveToken(signal)
  if (!token.ok) {
    return { status: 'error', code: token.error.code, message: token.error.message, guidance: token.error.guidance }
  }
  const client = state.client(token.token.value)
  const errorCode = (error: unknown): string =>
    error instanceof Error && error.name === 'AbortError' ? 'aborted'
      : error instanceof Error && 'status' in error && typeof error.status === 'number' ? `github-api-${error.status}` : 'fetch-failed'
  const rateLimitOf = (error: unknown): RateLimitValue | undefined => {
    if (error instanceof Error && 'rateLimit' in error) {
      const info = (error as { rateLimit?: { remaining: number | null; resetAt: number | null } }).rateLimit
      if (info !== undefined) return { remaining: info.remaining, resetAt: info.resetAt }
    }
    return undefined
  }
  const fail = (error: unknown): CiRunError => ({
    status: 'error',
    code: errorCode(error),
    message: error instanceof Error ? error.message : 'CI review failed',
    ...rateLimitOf(error) !== undefined ? { rateLimit: rateLimitOf(error) } : {},
  })

  let meta: PullMetaPayload
  let rateLimit: RateLimitValue = { remaining: null, resetAt: null }
  try {
    const response = await client.requestJson<PullMetaPayload>('GET', `/repos/${options.repo}/pulls/${options.pr}`, { signal })
    meta = response.data
    rateLimit = rateLimitValue(response.rateLimit)
  } catch (error) {
    return fail(error)
  }
  const headSha = meta.head?.sha ?? ''
  if (headSha.length === 0) return { status: 'error', code: 'no-head-sha', message: `PR #${options.pr} reports no head commit` }
  const additions = meta.additions ?? 0
  const deletions = meta.deletions ?? 0
  const labels = (meta.labels ?? []).map(label => label.name ?? '').filter(name => name.length > 0)

  // Filter step: label and path filters skip the PR without posting anything.
  const labelMatch = state.config.ci.labelFilters.length === 0
    || labels.some(label => state.config.ci.labelFilters.some(filter => filter.trim() === label))
  let files: ChangedFileStat[] = []
  try {
    for (let page = 1; page <= 4; page += 1) {
      const response = await client.requestJson<FileEntryPayload[]>('GET', `/repos/${options.repo}/pulls/${options.pr}/files?per_page=100&page=${page}`, { signal })
      for (const entry of response.data) {
        files.push({ path: entry.filename ?? '', added: entry.additions ?? 0, removed: entry.deletions ?? 0 })
      }
      if (response.data.length < 100 || files.length >= 400) break
    }
  } catch {
    files = [] // path filtering degrades to "match all" when the file list is unavailable.
  }
  const pathMatch = state.config.ci.pathFilters.length === 0
    || files.length === 0
    || files.some(file => matchesAnyGlob(file.path, state.config.ci.pathFilters))

  if (!labelMatch || !pathMatch) {
    let checkRun: CheckRunValue | undefined
    if (postCheck) {
      checkRun = await publishCheck(client, options.repo, headSha, state, 'skipped', 0, 'skipped: no label/path filter match')
    }
    const result: CiRunResult = {
      status: 'ok',
      repo: options.repo,
      pr: options.pr,
      headSha,
      verdict: 'skipped',
      engine: state.config.ci.engine,
      findings: [],
      summary: summarize('skipped', [], false),
      truncated: false,
      alreadyReviewed: false,
      ...checkRun !== undefined ? { checkRun } : {},
      rateLimit,
    }
    const reportFiles = options.task !== 'analyze' ? writeReports(state, result) : undefined
    return { ...result, ...reportFiles !== undefined ? { files: reportFiles } : {} }
  }

  // Idempotency: a completed check run for this head commit means the gate was
  // already published; a review-body marker means comments were already posted.
  // The marker scan always runs (not only when the check is missing), so a
  // rerun after a comment-only failure can repair the comments without
  // duplicating them.
  let existingCheck: CheckRunPayload | undefined
  let commentsPosted = false
  try {
    const checkName = encodeURIComponent(state.config.ci.checkName)
    const response = await client.requestJson<{ check_runs?: CheckRunPayload[] }>('GET', `/repos/${options.repo}/commits/${headSha}/check-runs?check_name=${checkName}`, { signal })
    existingCheck = (response.data.check_runs ?? []).find(run => run.status === 'completed')
  } catch {
    existingCheck = undefined
  }
  if (postComments) {
    try {
      const response = await client.requestJson<ReviewPayload[]>('GET', `/repos/${options.repo}/pulls/${options.pr}/reviews?per_page=100`, { signal })
      commentsPosted = response.data.some(review => hasReviewMarker(review.body, headSha))
    } catch {
      commentsPosted = false
    }
  }

  // The deterministic analysis runs even for an already-reviewed PR, so a
  // re-run can refresh the gate from the same inputs (zero cost, stable).
  let diffText = ''
  let truncated = false
  try {
    const text = await client.requestText('GET', `/repos/${options.repo}/pulls/${options.pr}`, { signal })
    truncated = text.text.length > maxDiffChars
    diffText = truncated ? text.text.slice(0, maxDiffChars) : text.text
  } catch (error) {
    return fail(error)
  }

  const lineFindings = analyzeDiff(diffText, maxDiffChars, { maxFindings: state.config.maxFindings, maxLineLength: state.config.maxLineLength }).findings
  const prFindings = analyzePr({
    files,
    additions,
    deletions,
    options: state.config.ci,
  })
  const staticFindings = [...prFindings, ...lineFindings]
  const extraFindings = options.task === 'publish' ? options.findings ?? [] : []
  const findings = mergeFindings(staticFindings, extraFindings)
  const verdict = verdictFor(findings, state.config.ci.failOn)

  if (options.task === 'analyze') {
    return {
      status: 'ok',
      repo: options.repo,
      pr: options.pr,
      headSha,
      verdict: 'skipped',
      engine: state.config.ci.engine,
      findings: staticFindings,
      summary: 'analysis prepared; no comments or checks were posted',
      truncated,
      alreadyReviewed: existingCheck !== undefined || commentsPosted,
      diffText,
      rateLimit,
    }
  }

  let review: ReviewPostValue | undefined
  if (postComments && !commentsPosted) {
    const inline = findings.filter(finding => finding.line !== null).slice(0, state.config.maxFindings)
    const prLevel = findings.filter(finding => finding.line === null)
    try {
      const posted = await client.requestJson<{ id?: number; html_url?: string }>('POST', `/repos/${options.repo}/pulls/${options.pr}/reviews`, {
        signal,
        body: {
          body: buildReviewBody(headSha, prLevel, options.body, truncated),
          event: 'COMMENT',
          ...inline.length > 0 ? {
            comments: inline.map(finding => ({
              path: finding.file,
              line: finding.line,
              body: `**${finding.severity}** \`${finding.rule}\`: ${finding.message}`,
            })),
          } : {},
        },
      })
      review = { url: posted.data.html_url ?? '', inlineComments: inline.length }
    } catch (error) {
      return fail(error)
    }
  } else if (postComments) {
    review = { url: '', inlineComments: 0 } // already posted at this head commit
  }

  let checkRun: CheckRunValue | undefined
  if (postCheck && existingCheck === undefined) {
    checkRun = await publishCheck(client, options.repo, headSha, state, verdict, findings.length, summarize(verdict, findings, truncated))
  } else if (existingCheck !== undefined) {
    checkRun = {
      id: existingCheck.id ?? 0,
      url: existingCheck.html_url ?? '',
      conclusion: existingCheck.conclusion ?? '',
    }
  }

  const effectiveVerdict = existingCheck !== undefined ? verdictFromConclusion(existingCheck.conclusion) : verdict
  const result: CiRunResult = {
    status: 'ok',
    repo: options.repo,
    pr: options.pr,
    headSha,
    verdict: effectiveVerdict,
    engine: state.config.ci.engine,
    findings,
    summary: existingCheck !== undefined ? `already reviewed at ${headSha.slice(0, 7)}: ${summarize(effectiveVerdict, findings, truncated)}` : summarize(effectiveVerdict, findings, truncated),
    truncated,
    alreadyReviewed: existingCheck !== undefined || commentsPosted,
    ...review !== undefined ? { review } : {},
    ...checkRun !== undefined ? { checkRun } : {},
    rateLimit,
  }
  const reportFiles = writeReports(state, result)
  return { ...result, files: reportFiles }
}

/** Verdict recovered from an existing check conclusion. */
function verdictFromConclusion(conclusion: string | null | undefined): CiVerdict {
  if (conclusion === 'failure' || conclusion === 'action_required') return 'needs-changes'
  if (conclusion === 'neutral') return 'skipped'
  return 'pass'
}

/** Create one completed status check for the run. */
async function publishCheck(
  client: ReturnType<GithubState['client']>,
  repo: string,
  headSha: string,
  state: GithubState,
  verdict: CiVerdict,
  findingCount: number,
  summary: string,
): Promise<CheckRunValue | undefined> {
  const conclusion = verdict === 'pass' ? 'success' : verdict === 'needs-changes' ? (state.config.ci.blocking ? 'failure' : 'neutral') : 'neutral'
  try {
    const posted = await client.requestJson<{ id?: number; html_url?: string }>('POST', `/repos/${repo}/commits/${headSha}/check-runs`, {
      body: {
        name: state.config.ci.checkName,
        head_sha: headSha,
        status: 'completed',
        conclusion,
        completed_at: new Date().toISOString(),
        output: {
          title: `dsh-github review: ${verdict}`,
          summary: `${summary}\n\n${verdict === 'needs-changes' ? (state.config.ci.blocking ? 'Blocking: merge is held until the findings are addressed.' : 'Non-blocking: the gate reports findings without failing the check.') : ''}`,
          annotations: [],
        },
      },
    })
    return { id: posted.data.id ?? 0, url: posted.data.html_url ?? '', conclusion }
  } catch {
    return undefined // the gate degrades to the report files; callers see the verdict in the result.
  }
}
