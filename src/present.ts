/**
 * Pure UI-card presenters for the dsh-github tools.
 *
 * Presenters run on live streaming AND on session-log replay, so they must be
 * pure functions of their arguments — no I/O, no clock, no random, no plugin
 * state. The canonical value reaches `presentResult` through the persisted
 * `result.meta` populated by each tool's pure `presentationMeta` projection.
 * @module dsh-github/present
 */
import type { ToolCallView, ToolResult, ToolResultView } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-session'

/** Narrow structural view of pr_create arguments. */
export interface PrCreateArgs {
  title: string
  base?: string
  head?: string
  draft?: boolean
  ownerRepo?: string
}

/** Narrow structural view of a created-PR canonical value. */
export interface CreatedPrValue {
  status: 'created'
  url: string
  number: number
  title: string
  state: string
  draft: boolean
  base: string
  head: string
}

/** Narrow structural view of the shared error canonical value. */
export interface GithubErrorValue {
  status: 'error'
  code: string
  message: string
  guidance?: string
}

/** Pending card for pr_create. */
export function prCreateCall(args: PrCreateArgs): ToolCallView {
  return {
    card: 'generic',
    title: `Create pull request: ${args.title}`,
    rawInput: {
      title: args.title,
      ...args.base !== undefined ? { base: args.base } : {},
      ...args.head !== undefined ? { head: args.head } : {},
      ...args.draft !== undefined ? { draft: args.draft } : {},
      ...args.ownerRepo !== undefined ? { ownerRepo: args.ownerRepo } : {},
    },
  }
}

/** Completed card for pr_create: the PR link, or a readable failure. */
export function prCreateResult(_args: PrCreateArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as CreatedPrValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if (value.status === 'error') {
    return { card: 'generic', title: 'Pull request not created', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] }
  }
  return {
    card: 'generic',
    title: `Created pull request #${value.number}`,
    content: [{ type: 'text', text: `${value.url}\n${value.base} ← ${value.head}${value.draft ? ' (draft)' : ''}` }],
  }
}

/** Narrow structural view of review_post arguments. */
export interface ReviewPostArgs {
  jobId: string
}

/** Narrow structural view of a posted-review canonical value. */
export interface PostedReviewValue {
  status: 'posted'
  url: string
  commentId: number
  findings: number
}

/** Pending card for review_post. */
export function reviewPostCall(args: ReviewPostArgs): ToolCallView {
  return { card: 'generic', title: `Post review comments (job ${args.jobId})`, rawInput: args.jobId }
}

/** Completed card for review_post. */
export function reviewPostResult(_args: ReviewPostArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as PostedReviewValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if (value.status === 'error') {
    return { card: 'generic', title: 'Review comments not posted', content: [{ type: 'text', text: value.message }] }
  }
  return { card: 'generic', title: 'Review comments posted', content: [{ type: 'text', text: `${value.url}\n${value.findings} finding(s) reported` }] }
}

/** Narrow structural view of issue_open arguments. */
export interface IssueOpenArgs {
  title: string
  body?: string
  labels?: string[]
  ownerRepo?: string
}

/** Narrow structural view of a created-issue canonical value. */
export interface CreatedIssueValue {
  status: 'created'
  url: string
  number: number
  title: string
}

/** Pending card for issue_open. */
export function issueOpenCall(args: IssueOpenArgs): ToolCallView {
  return { card: 'generic', title: `Create issue: ${args.title}`, rawInput: { title: args.title } }
}

/** Completed card for issue_open. */
export function issueOpenResult(_args: IssueOpenArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as CreatedIssueValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if (value.status === 'error') {
    return { card: 'generic', title: 'Issue not created', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] }
  }
  return { card: 'generic', title: `Created issue #${value.number}`, content: [{ type: 'text', text: value.url }] }
}

/** Narrow structural view of gh_review arguments. */
export interface GhReviewArgs {
  pr: string
  fields?: string[]
  maxDiffChars?: number
}

/** Narrow structural view of one gh_review finding. */
export interface FindingValue {
  file: string
  line?: number | null
  severity: 'info' | 'warning' | 'error'
  rule: string
  message: string
}

/** Narrow structural view of the gh_review canonical value. */
export interface PrSummaryValue {
  repo: string
  number: number
  title: string
  state: string
  author: string
  url: string
  additions: number
  deletions: number
  base: string
  head: string
  ci: { summary: string; status?: string; conclusion?: string; runs?: Array<{ name: string; status: string; conclusion?: string }> }
  comments?: Array<{ id: number; user: string; path?: string; line?: number; body: string }>
  findings?: FindingValue[]
  diff: { length: number; truncated: boolean; excerpt: string; files?: Array<{ path: string; added: number; removed: number }> }
  rateLimit: { remaining?: number | null; resetAt?: number | null }
}

/** Pending card for gh_review. */
export function ghReviewCall(args: GhReviewArgs): ToolCallView {
  return { card: 'generic', title: `Review PR ${args.pr}`, rawInput: { pr: args.pr, fields: args.fields ?? 'all' } }
}

/** Completed card for gh_review: headline facts and CI state. */
export function ghReviewResult(_args: GhReviewArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as PrSummaryValue | undefined
  if (value === undefined) return undefined
  return {
    card: 'generic',
    title: `PR #${value.number} — ${value.title}`,
    content: [{
      type: 'text',
      text: `${value.repo} · ${value.state} · ${value.base} ← ${value.head}\n`
        + `+${value.additions} −${value.deletions} · ${value.comments?.length ?? 0} comment(s) · ${value.findings?.length ?? 0} finding(s)\n`
        + `CI: ${value.ci.summary}`,
    }],
  }
}

/** Narrow structural view of gh_issue arguments. */
export interface GhIssueArgs {
  action: 'list' | 'get' | 'comments'
  ownerRepo?: string
  issueNumber?: number
  state?: string
  limit?: number
}

/** Narrow structural view of one gh_issue item. */
export interface IssueItemValue {
  number: number
  title: string
  state: string
  author: string
  url: string
  comments: number
  createdAt: string
  body: string | null
}

/** Narrow structural view of the gh_issue canonical value. */
export interface IssueListValue {
  repo: string
  action: 'list' | 'get' | 'comments'
  total: number
  items?: IssueItemValue[]
  rateLimit: { remaining?: number | null; resetAt?: number | null }
}

/** Pending card for gh_issue. */
export function ghIssueCall(args: GhIssueArgs): ToolCallView {
  return { card: 'generic', title: `GitHub issues: ${args.action}`, rawInput: args }
}

/** Completed card for gh_issue. */
export function ghIssueResult(_args: GhIssueArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as IssueListValue | undefined
  if (value === undefined) return undefined
  return {
    card: 'generic',
    title: `Issues (${value.action}) — ${value.repo}`,
    content: [{ type: 'text', text: (value.items ?? []).map(item => `#${item.number} ${item.title} [${item.state}]`).join('\n') || '(no issues)' }],
  }
}

/** Identity projection: persist the whole canonical value for card replay. */
export function identityMeta(_args: unknown, value: JsonValue): JsonValue {
  return value
}
