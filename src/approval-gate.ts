/**
 * The write-action approval gate: a `tools/pre-execute` waterfall listener.
 *
 * Every dsh-github write tool (`pr_create`, `pr_merge`, `pr_update`,
 * `review_post`, `issue_open`, `issue_comment`, `issue_close`) asks the human
 * through the registry-owned approval path (`ask` → ctx.approval), which
 * appends the approval/asked + approval/decided audit pair and fails closed
 * without an answerer. Actions missing from the `allowedActions` whitelist are
 * denied before any prompt. Every other tool passes through via `next()` — the
 * waterfall contract requires it. Approval reasons preview what would be
 * published (titles, body lengths, and the first line of an overridden review
 * body) without ever containing the token.
 * @module dsh-github/approval-gate
 */
import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'
import type { GithubAction } from './config.ts'
import type { GithubState } from './state.ts'

const ACTION_BY_TOOL: Record<string, GithubAction> = {
  pr_create: 'pr.create',
  pr_merge: 'pr.merge',
  pr_update: 'pr.update',
  review_post: 'review.post',
  issue_open: 'issue.create',
  issue_comment: 'issue.comment',
  issue_close: 'issue.close',
}

/** Tools the gate intercepts; everything else delegates via next(). */
const WRITE_TOOLS = new Set(Object.keys(ACTION_BY_TOOL))

/** Read the frozen tool arguments as a plain object, tolerant of bad input. */
function argumentsAsRecord(exec: ToolExecution): Record<string, unknown> {
  return typeof exec.arguments === 'object' && exec.arguments !== null ? exec.arguments as Record<string, unknown> : {}
}

/** `"title" (body N chars)`-style preview of a titled write. */
function titledPreview(args: Record<string, unknown>): string {
  const title = typeof args.title === 'string' ? args.title : '(untitled)'
  const body = typeof args.body === 'string' ? args.body.trim() : ''
  return body.length === 0 ? `"${title}"` : `"${title}" (body ${body.length} chars)`
}

/** First line of a string, elided to `max` characters. */
function firstLine(value: string, max: number): string {
  const line = value.split('\n')[0] ?? ''
  return line.length > max ? `${line.slice(0, max)}…` : line
}

/** Human-readable reason for the approval prompt of one write call. */
function askReason(toolName: string, args: Record<string, unknown>, state: GithubState): string {
  if (toolName === 'pr_create') {
    return `create GitHub pull request ${titledPreview(args)}`
  }
  if (toolName === 'pr_merge') {
    const target = typeof args.pr === 'string' ? ` ${args.pr}` : ''
    const method = typeof args.mergeMethod === 'string' ? args.mergeMethod : 'merge'
    const deleteBranch = args.deleteBranch === true ? ' (delete head branch after merge)' : ''
    return `merge GitHub pull request${target} via ${method}${deleteBranch}`
  }
  if (toolName === 'pr_update') {
    const target = typeof args.pr === 'string' ? ` ${args.pr}` : ''
    const edits: string[] = []
    if (typeof args.title === 'string') edits.push(`title "${firstLine(args.title, 60)}"`)
    if (typeof args.state === 'string') edits.push(`state ${args.state}`)
    if (typeof args.base === 'string') edits.push(`base ${args.base}`)
    if (typeof args.body === 'string' && args.body.trim().length > 0) edits.push(`body ${args.body.trim().length} chars`)
    return `update GitHub pull request${target}${edits.length > 0 ? ` (${edits.join('; ')})` : ''}`
  }
  if (toolName === 'review_post') {
    if (typeof args.jobId !== 'string') return 'post GitHub review comments'
    const record = state.records.get(args.jobId)
    const isModelReview = record?.report !== null && record?.report !== undefined && record.report.findings.length === 0 && record.report.summary.startsWith('model review')
    const target = record === undefined || record.report === null
      ? `job ${args.jobId}`
      : isModelReview
        ? `PR #${record.pr} (model review)`
        : `PR #${record.pr} (${record.report.findings.length} finding(s))`
    const mode = args.mode === 'inline' ? 'inline' : 'summary'
    const override = typeof args.body === 'string' && args.body.trim().length > 0
      ? `; body override: ${firstLine(args.body.trim(), 80)}`
      : ''
    return `post GitHub review comments for ${target} (${mode})${override}`
  }
  if (toolName === 'issue_open') {
    return `create GitHub issue ${titledPreview(args)}`
  }
  if (toolName === 'issue_comment') {
    const number = typeof args.issueNumber === 'number' ? ` #${args.issueNumber}` : ''
    const body = typeof args.body === 'string' ? args.body.trim() : ''
    return `comment on GitHub issue${number}${body.length === 0 ? '' : ` (body ${body.length} chars)`}`
  }
  if (toolName === 'issue_close') {
    const number = typeof args.issueNumber === 'number' ? ` #${args.issueNumber}` : ''
    return `close GitHub issue${number}`
  }
  return 'perform a GitHub write action'
}

/**
 * Register the approval gate. Registration is an effect: disposing the plugin
 * fiber removes the listener.
 * @param ctx - plugin context; the listener lives on the shared tools pipeline.
 * @param state - plugin state used to enrich approval reasons.
 * @returns the effect disposer.
 */
export function registerApprovalGate(ctx: Context, state: GithubState): () => void {
  return ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (!WRITE_TOOLS.has(exec.name)) return next()
    const action = ACTION_BY_TOOL[exec.name]
    if (action === undefined || !state.config.allowedActions.includes(action)) {
      return { kind: 'deny', reason: `dsh-github: action "${action ?? exec.name}" is not in allowedActions` }
    }
    return { kind: 'ask', reason: `dsh-github: ${askReason(exec.name, argumentsAsRecord(exec), state)}` }
  })
}
