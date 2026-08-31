/**
 * Pure UI-card presenters for the dsh-github tools.
 *
 * Presenters run on live streaming AND on session-log replay, so they must be
 * pure functions of their arguments 鈥?no I/O, no clock, no random, no plugin
 * state. The canonical value reaches `presentResult` through the persisted
 * `result.meta` populated by each tool's pure `presentationMeta` projection.
 * @module dsh-github/present
 */
import type { ToolCallView, ToolResult, ToolResultView } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

/** Rate-limit facts shared by every canonical value. */
export interface RateLimitValueView {
  remaining?: number | null
  resetAt?: number | null
}

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
  rateLimit: RateLimitValueView
}

/** Narrow structural view of the shared error canonical value. */
export interface GithubErrorValue {
  status: 'error'
  code: string
  message: string
  guidance?: string
  rateLimit?: RateLimitValueView
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
    content: [{ type: 'text', text: `${value.url}\n${value.base} 鈫?${value.head}${value.draft ? ' (draft)' : ''}` }],
  }
}

/** Narrow structural view of review_post arguments. */
export interface ReviewPostArgs {
  jobId: string
  mode?: 'summary' | 'inline'
  body?: string
}

/** Narrow structural view of a posted-review canonical value. */
export interface PostedReviewValue {
  status: 'posted'
  mode: 'summary' | 'inline'
  url: string
  commentId?: number
  reviewId?: number
  findings: number
  rateLimit: RateLimitValueView
}

/** Pending card for review_post. */
export function reviewPostCall(args: ReviewPostArgs): ToolCallView {
  return {
    card: 'generic',
    title: `Post review comments (job ${args.jobId})`,
    rawInput: {
      jobId: args.jobId,
      ...args.mode !== undefined ? { mode: args.mode } : {},
      ...args.body !== undefined ? { bodyChars: args.body.length } : {},
    },
  }
}

/** Completed card for review_post. */
export function reviewPostResult(_args: ReviewPostArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as PostedReviewValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if (value.status === 'error') {
    return { card: 'generic', title: 'Review comments not posted', content: [{ type: 'text', text: value.message }] }
  }
  const kind = value.mode === 'inline' ? 'Inline review' : 'Review comments'
  return { card: 'generic', title: `${kind} posted`, content: [{ type: 'text', text: `${value.url}\n${value.findings} finding(s) reported` }] }
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
  rateLimit: RateLimitValueView
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

/** Narrow structural view of issue_comment arguments. */
export interface IssueCommentArgs {
  ownerRepo?: string
  issueNumber: number
  body: string
}

/** Narrow structural view of an issue-comment canonical value. */
export interface IssueCommentValue {
  status: 'commented'
  url: string
  commentId: number
  issueNumber: number
  rateLimit: RateLimitValueView
}

/** Pending card for issue_comment. */
export function issueCommentCall(args: IssueCommentArgs): ToolCallView {
  return { card: 'generic', title: `Comment on #${args.issueNumber}`, rawInput: { issueNumber: args.issueNumber, ...args.ownerRepo !== undefined ? { ownerRepo: args.ownerRepo } : {} } }
}

/** Completed card for issue_comment. */
export function issueCommentResult(_args: IssueCommentArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as IssueCommentValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if (value.status === 'error') {
    return { card: 'generic', title: 'Comment not posted', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] }
  }
  return { card: 'generic', title: `Commented on #${value.issueNumber}`, content: [{ type: 'text', text: value.url }] }
}

/** Narrow structural view of issue_close arguments. */
export interface IssueCloseArgs {
  ownerRepo?: string
  issueNumber: number
  stateReason?: 'completed' | 'not_planned'
}

/** Narrow structural view of a closed-issue canonical value. */
export interface IssueClosedValue {
  status: 'closed'
  url: string
  number: number
  title: string
  rateLimit: RateLimitValueView
}

/** Pending card for issue_close. */
export function issueCloseCall(args: IssueCloseArgs): ToolCallView {
  return { card: 'generic', title: `Close issue #${args.issueNumber}`, rawInput: { issueNumber: args.issueNumber, ...args.stateReason !== undefined ? { stateReason: args.stateReason } : {} } }
}

/** Completed card for issue_close. */
export function issueCloseResult(_args: IssueCloseArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as IssueClosedValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if (value.status === 'error') {
    return { card: 'generic', title: 'Issue not closed', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] }
  }
  return { card: 'generic', title: `Closed issue #${value.number}`, content: [{ type: 'text', text: value.url }] }
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
  ci: {
    summary: string
    status?: string
    conclusion?: string
    error?: string
    runs?: Array<{ name: string; status: string; conclusion?: string }>
  }
  comments: {
    items: Array<{ id: number; user: string; path?: string; line?: number; body: string }>
    error?: string
  }
  findings?: FindingValue[]
  diff: {
    length: number
    truncated: boolean
    excerpt: string
    text: string
    error?: string
    files?: Array<{ path: string; added: number; removed: number }>
  }
  rateLimit: RateLimitValueView
}

/** Pending card for gh_review. */
export function ghReviewCall(args: GhReviewArgs): ToolCallView {
  return { card: 'generic', title: `Review PR ${args.pr}`, rawInput: { pr: args.pr, fields: args.fields ?? 'all' } }
}

/** Completed card for gh_review: headline facts and CI state. */
export function ghReviewResult(_args: GhReviewArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as PrSummaryValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if ('status' in value) {
    return { card: 'generic', title: 'PR review failed', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] }
  }
  return {
    card: 'generic',
    title: `PR #${value.number} 鈥?${value.title}`,
    content: [{
      type: 'text',
      text: `${value.repo} 路 ${value.state} 路 ${value.base} 鈫?${value.head}\n`
        + `+${value.additions} 鈭?{value.deletions} 路 ${value.comments.items?.length ?? 0} comment(s) 路 ${value.findings?.length ?? 0} finding(s)\n`
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
  kind: 'issue' | 'pr' | 'comment'
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
  rateLimit: RateLimitValueView
}

/** Pending card for gh_issue. */
export function ghIssueCall(args: GhIssueArgs): ToolCallView {
  return { card: 'generic', title: `GitHub issues: ${args.action}`, rawInput: args }
}

/** Completed card for gh_issue. */
export function ghIssueResult(_args: GhIssueArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as IssueListValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if ('status' in value) {
    return { card: 'generic', title: 'Issue read failed', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] }
  }
  return {
    card: 'generic',
    title: `Issues (${value.action}) 鈥?${value.repo}`,
    content: [{ type: 'text', text: (value.items ?? []).map(item => `#${item.number} ${item.title} [${item.kind}/${item.state}]`).join('\n') || '(no issues)' }],
  }
}

/** Narrow structural view of gh_search arguments. */
export interface SearchArgs {  q: string
  sort?: 'comments' | 'reactions' | 'created' | 'updated'
  order?: 'desc' | 'asc'
  perPage?: number
}

/** Narrow structural view of one gh_search item. */
export interface SearchItemValue {
  number: number
  title: string
  state: string
  kind: 'issue' | 'pr'
  author: string
  url: string
  repo: string
  comments: number
  createdAt: string
}

/** Narrow structural view of the gh_search canonical value. */
export interface SearchValue {
  query: string
  total: number
  items: SearchItemValue[]
  rateLimit: RateLimitValueView
}

/** Pending card for gh_search. */
export function ghSearchCall(args: SearchArgs): ToolCallView {
  return { card: 'generic', title: `Search GitHub: ${args.q}`, rawInput: { q: args.q } }
}

/** Completed card for gh_search. */
export function ghSearchResult(_args: SearchArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as SearchValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if ('status' in value) {
    return { card: 'generic', title: 'Search failed', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] }
  }
  return {
    card: 'generic',
    title: `Search results 鈥?${value.total} total`,
    content: [{ type: 'text', text: value.items.map(item => `#${item.number} ${item.title} [${item.kind}/${item.state}] ${item.repo}`).join('\n') || '(no results)' }],
  }
}

/** Identity projection: persist the whole canonical value for card replay. */
export function identityMeta(_args: unknown, value: JsonValue): JsonValue {
  return value
}

/** Narrow structural view of pr_merge arguments. */
export interface PrMergeArgs {
  pr: string
  mergeMethod?: 'merge' | 'squash' | 'rebase'
  commitTitle?: string
  commitMessage?: string
  deleteBranch?: boolean
}

/** Narrow structural view of a merged-PR canonical value. */
export interface MergedPrValue {
  status: 'merged'
  merged: boolean
  sha?: string
  message: string
  url: string
  branchDeleted: boolean
  rateLimit: RateLimitValueView
}

/** Pending card for pr_merge. */
export function prMergeCall(args: PrMergeArgs): ToolCallView {
  return {
    card: 'generic',
    title: `Merge pull request ${args.pr}`,
    rawInput: {
      pr: args.pr,
      ...args.mergeMethod !== undefined ? { mergeMethod: args.mergeMethod } : {},
      ...args.deleteBranch !== undefined ? { deleteBranch: args.deleteBranch } : {},
    },
  }
}

/** Completed card for pr_merge: the merge result, or a readable failure. */
export function prMergeResult(_args: PrMergeArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as MergedPrValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if (value.status === 'error') {
    return { card: 'generic', title: 'Pull request not merged', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] }
  }
  return {
    card: 'generic',
    title: value.merged ? 'Pull request merged' : 'Merge not performed',
    content: [{ type: 'text', text: `${value.message}\n${value.url}${value.branchDeleted ? '\nhead branch deleted' : ''}` }],
  }
}

/** Narrow structural view of pr_update arguments. */
export interface PrUpdateArgs {
  pr: string
  title?: string
  body?: string
  state?: 'open' | 'closed'
  base?: string
}

/** Narrow structural view of an updated-PR canonical value. */
export interface UpdatedPrValue {
  status: 'updated'
  url: string
  number: number
  title: string
  state: string
  base: string
  rateLimit: RateLimitValueView
}

/** Pending card for pr_update. */
export function prUpdateCall(args: PrUpdateArgs): ToolCallView {
  return {
    card: 'generic',
    title: `Update pull request ${args.pr}`,
    rawInput: {
      pr: args.pr,
      ...args.title !== undefined ? { title: args.title } : {},
      ...args.state !== undefined ? { state: args.state } : {},
      ...args.base !== undefined ? { base: args.base } : {},
    },
  }
}

/** Completed card for pr_update. */
export function prUpdateResult(_args: PrUpdateArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as UpdatedPrValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if (value.status === 'error') {
    return { card: 'generic', title: 'Pull request not updated', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] }
  }
  return {
    card: 'generic',
    title: `Updated pull request #${value.number}`,
    content: [{ type: 'text', text: `${value.url}\n${value.title} (${value.state}, base ${value.base})` }],
  }
}

/** Narrow structural view of gh_repo arguments. */
export interface GhRepoArgs {
  ownerRepo?: string
}

/** Narrow structural view of the gh_repo canonical value. */
export interface RepoValue {
  repo: string
  description: string
  defaultBranch: string
  visibility: string
  stars: number
  forks: number
  openIssues: number
  language: string
  license: string
  topics: string[]
  url: string
  updatedAt: string
  rateLimit: RateLimitValueView
}

/** Pending card for gh_repo. */
export function ghRepoCall(args: GhRepoArgs): ToolCallView {
  return { card: 'generic', title: `Repository metadata${args.ownerRepo !== undefined ? `: ${args.ownerRepo}` : ''}`, rawInput: { ...args.ownerRepo !== undefined ? { ownerRepo: args.ownerRepo } : {} } }
}

/** Completed card for gh_repo. */
export function ghRepoResult(_args: GhRepoArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as RepoValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if ('status' in value) {
    return { card: 'generic', title: 'Repository read failed', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] }
  }
  return {
    card: 'generic',
    title: value.repo,
    content: [{
      type: 'text',
      text: `${value.description}\n`
        + `${value.defaultBranch} 路 ${value.language ?? 'unknown language'} 路 ${value.license}\n`
        + `猸?${value.stars} 路 馃嵈 ${value.forks} 路 issues ${value.openIssues} 路 ${value.visibility}\n`
        + `${value.url}`,
    }],
  }
}

/** Narrow structural view of gh_file arguments. */
export interface GhFileArgs {
  ownerRepo?: string
  path: string
  ref?: string
  maxChars?: number
}

/** Narrow structural view of the gh_file canonical value. */
export interface FileValue {
  repo: string
  path: string
  ref: string
  size: number
  truncated: boolean
  content: string
  sha: string
  url: string
  rateLimit: RateLimitValueView
}

/** Pending card for gh_file. */
export function ghFileCall(args: GhFileArgs): ToolCallView {
  return { card: 'generic', title: `Read file: ${args.path}`, rawInput: { path: args.path, ...args.ref !== undefined ? { ref: args.ref } : {} } }
}

/** Completed card for gh_file: first lines plus size facts. */
export function ghFileResult(_args: GhFileArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as FileValue | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if ('status' in value) {
    return { card: 'generic', title: 'File read failed', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] }
  }
  const preview = value.content.split('\n').slice(0, 12).join('\n')
  return {
    card: 'generic',
    title: `${value.repo}/${value.path} @ ${value.ref}`,
    content: [{
      type: 'text',
      text: `${value.size} bytes${value.truncated ? ' (truncated)' : ''} 路 ${value.sha.slice(0, 7)}\n${preview}${value.content.length > preview.length ? '\n鈥? : ''}`,
    }],
  }
}

/** Narrow structural view of ci_run arguments. */
export interface CiRunArgs {
  task: 'review' | 'analyze' | 'publish'
  pr: string
  ownerRepo?: string
  maxDiffChars?: number
  body?: string
  findings?: Array<{ file: string; line?: number | null; severity: 'info' | 'warning' | 'error'; rule: string; message: string }>
  postComments?: boolean
  postCheck?: boolean
}

/** Narrow structural view of the ci_run canonical value. */
export interface CiRunValueView {
  status: 'ok'
  repo: string
  pr: number
  headSha: string
  verdict: 'pass' | 'needs-changes' | 'skipped'
  engine: 'static' | 'model'
  findings: Array<{ file: string; line: number | null; severity: string; rule: string; message: string }>
  summary: string
  truncated: boolean
  alreadyReviewed: boolean
  diffText?: string
  checkRun?: { id: number; url: string; conclusion: string }
  review?: { url: string; inlineComments: number }
  files?: { json: string; markdown: string }
  rateLimit: RateLimitValueView
}

/** Pending card for ci_run. */
export function ciRunCall(args: CiRunArgs): ToolCallView {
  return {
    card: 'generic',
    title: `CI ${args.task}: ${args.pr}`,
    rawInput: {
      task: args.task,
      pr: args.pr,
      ...args.ownerRepo !== undefined ? { ownerRepo: args.ownerRepo } : {},
      ...args.maxDiffChars !== undefined ? { maxDiffChars: args.maxDiffChars } : {},
      ...args.body !== undefined ? { bodyChars: args.body.length } : {},
      ...args.findings !== undefined ? { findings: args.findings.length } : {},
    },
  }
}

/** Completed card for ci_run: verdict plus the check link. */
export function ciRunResult(_args: CiRunArgs, result: ToolResult): ToolResultView | undefined {
  const value = result.meta as CiRunValueView | GithubErrorValue | undefined
  if (value === undefined) return undefined
  if (value.status === 'error') {
    return { card: 'generic', title: 'CI run failed', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] }
  }
  const lines = [`PR #${value.pr} in ${value.repo}: verdict ${value.verdict} (${value.findings.length} finding(s))${value.alreadyReviewed ? ' 路 already reviewed at this head commit' : ''}`]
  if (value.checkRun !== undefined) lines.push(`check: ${value.checkRun.url} (${value.checkRun.conclusion})`)
  if (value.review !== undefined && value.review.url.length > 0) lines.push(`review: ${value.review.url} (${value.review.inlineComments} inline comment(s))`)
  if (value.files !== undefined) lines.push(`reports: ${value.files.json} 路 ${value.files.markdown}`)
  return { card: 'generic', title: `CI review verdict: ${value.verdict}`, content: [{ type: 'text', text: lines.join('\n') }] }
}
