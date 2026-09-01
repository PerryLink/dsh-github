/**
 * Pure UI-card presenters for the dsh-github tools.
 *
 * Presenters run on live streaming AND on session-log replay, so they must be
 * pure functions of their arguments — no I/O, no clock, no random, no plugin
 * state. The canonical value reaches `presentResult` through the persisted
 * `result.meta` populated by each tool's pure `presentationMeta` projection.
 * @module dsh-github/present
 */
import type { ToolCallView, ToolResult, ToolResultView } from '@deepseek-ai/dsh-tools';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
/** Rate-limit facts shared by every canonical value. */
export interface RateLimitValueView {
    remaining?: number | null;
    resetAt?: number | null;
}
/** Narrow structural view of pr_create arguments. */
export interface PrCreateArgs {
    title: string;
    base?: string;
    head?: string;
    draft?: boolean;
    ownerRepo?: string;
}
/** Narrow structural view of a created-PR canonical value. */
export interface CreatedPrValue {
    status: 'created';
    url: string;
    number: number;
    title: string;
    state: string;
    draft: boolean;
    base: string;
    head: string;
    rateLimit: RateLimitValueView;
}
/** Narrow structural view of the shared error canonical value. */
export interface GithubErrorValue {
    status: 'error';
    code: string;
    message: string;
    guidance?: string;
    rateLimit?: RateLimitValueView;
}
/** Pending card for pr_create. */
export declare function prCreateCall(args: PrCreateArgs): ToolCallView;
/** Completed card for pr_create: the PR link, or a readable failure. */
export declare function prCreateResult(_args: PrCreateArgs, result: ToolResult): ToolResultView | undefined;
/** Narrow structural view of review_post arguments. */
export interface ReviewPostArgs {
    jobId: string;
    mode?: 'summary' | 'inline';
    body?: string;
}
/** Narrow structural view of a posted-review canonical value. */
export interface PostedReviewValue {
    status: 'posted';
    mode: 'summary' | 'inline';
    url: string;
    commentId?: number;
    reviewId?: number;
    findings: number;
    rateLimit: RateLimitValueView;
}
/** Pending card for review_post. */
export declare function reviewPostCall(args: ReviewPostArgs): ToolCallView;
/** Completed card for review_post. */
export declare function reviewPostResult(_args: ReviewPostArgs, result: ToolResult): ToolResultView | undefined;
/** Narrow structural view of issue_open arguments. */
export interface IssueOpenArgs {
    title: string;
    body?: string;
    labels?: string[];
    ownerRepo?: string;
}
/** Narrow structural view of a created-issue canonical value. */
export interface CreatedIssueValue {
    status: 'created';
    url: string;
    number: number;
    title: string;
    rateLimit: RateLimitValueView;
}
/** Pending card for issue_open. */
export declare function issueOpenCall(args: IssueOpenArgs): ToolCallView;
/** Completed card for issue_open. */
export declare function issueOpenResult(_args: IssueOpenArgs, result: ToolResult): ToolResultView | undefined;
/** Narrow structural view of issue_comment arguments. */
export interface IssueCommentArgs {
    ownerRepo?: string;
    issueNumber: number;
    body: string;
}
/** Narrow structural view of an issue-comment canonical value. */
export interface IssueCommentValue {
    status: 'commented';
    url: string;
    commentId: number;
    issueNumber: number;
    rateLimit: RateLimitValueView;
}
/** Pending card for issue_comment. */
export declare function issueCommentCall(args: IssueCommentArgs): ToolCallView;
/** Completed card for issue_comment. */
export declare function issueCommentResult(_args: IssueCommentArgs, result: ToolResult): ToolResultView | undefined;
/** Narrow structural view of issue_close arguments. */
export interface IssueCloseArgs {
    ownerRepo?: string;
    issueNumber: number;
    stateReason?: 'completed' | 'not_planned';
}
/** Narrow structural view of a closed-issue canonical value. */
export interface IssueClosedValue {
    status: 'closed';
    url: string;
    number: number;
    title: string;
    rateLimit: RateLimitValueView;
}
/** Pending card for issue_close. */
export declare function issueCloseCall(args: IssueCloseArgs): ToolCallView;
/** Completed card for issue_close. */
export declare function issueCloseResult(_args: IssueCloseArgs, result: ToolResult): ToolResultView | undefined;
/** Narrow structural view of gh_review arguments. */
export interface GhReviewArgs {
    pr: string;
    fields?: string[];
    maxDiffChars?: number;
}
/** Narrow structural view of one gh_review finding. */
export interface FindingValue {
    file: string;
    line?: number | null;
    severity: 'info' | 'warning' | 'error';
    rule: string;
    message: string;
}
/** Narrow structural view of the gh_review canonical value. */
export interface PrSummaryValue {
    repo: string;
    number: number;
    title: string;
    state: string;
    author: string;
    url: string;
    additions: number;
    deletions: number;
    base: string;
    head: string;
    ci: {
        summary: string;
        status?: string;
        conclusion?: string;
        error?: string;
        runs?: Array<{
            name: string;
            status: string;
            conclusion?: string;
        }>;
    };
    comments: {
        items: Array<{
            id: number;
            user: string;
            path?: string;
            line?: number;
            body: string;
        }>;
        error?: string;
    };
    findings?: FindingValue[];
    diff: {
        length: number;
        truncated: boolean;
        excerpt: string;
        text: string;
        error?: string;
        files?: Array<{
            path: string;
            added: number;
            removed: number;
        }>;
    };
    rateLimit: RateLimitValueView;
}
/** Pending card for gh_review. */
export declare function ghReviewCall(args: GhReviewArgs): ToolCallView;
/** Completed card for gh_review: headline facts and CI state. */
export declare function ghReviewResult(_args: GhReviewArgs, result: ToolResult): ToolResultView | undefined;
/** Narrow structural view of gh_issue arguments. */
export interface GhIssueArgs {
    action: 'list' | 'get' | 'comments';
    ownerRepo?: string;
    issueNumber?: number;
    state?: string;
    limit?: number;
}
/** Narrow structural view of one gh_issue item. */
export interface IssueItemValue {
    number: number;
    title: string;
    state: string;
    kind: 'issue' | 'pr' | 'comment';
    author: string;
    url: string;
    comments: number;
    createdAt: string;
    body: string | null;
}
/** Narrow structural view of the gh_issue canonical value. */
export interface IssueListValue {
    repo: string;
    action: 'list' | 'get' | 'comments';
    total: number;
    items?: IssueItemValue[];
    rateLimit: RateLimitValueView;
}
/** Pending card for gh_issue. */
export declare function ghIssueCall(args: GhIssueArgs): ToolCallView;
/** Completed card for gh_issue. */
export declare function ghIssueResult(_args: GhIssueArgs, result: ToolResult): ToolResultView | undefined;
/** Narrow structural view of gh_search arguments. */
export interface SearchArgs {
    q: string;
    sort?: 'comments' | 'reactions' | 'created' | 'updated';
    order?: 'desc' | 'asc';
    perPage?: number;
}
/** Narrow structural view of one gh_search item. */
export interface SearchItemValue {
    number: number;
    title: string;
    state: string;
    kind: 'issue' | 'pr';
    author: string;
    url: string;
    repo: string;
    comments: number;
    createdAt: string;
}
/** Narrow structural view of the gh_search canonical value. */
export interface SearchValue {
    query: string;
    total: number;
    items: SearchItemValue[];
    rateLimit: RateLimitValueView;
}
/** Pending card for gh_search. */
export declare function ghSearchCall(args: SearchArgs): ToolCallView;
/** Completed card for gh_search. */
export declare function ghSearchResult(_args: SearchArgs, result: ToolResult): ToolResultView | undefined;
/** Identity projection: persist the whole canonical value for card replay. */
export declare function identityMeta(_args: unknown, value: JsonValue): JsonValue;
/** Narrow structural view of pr_merge arguments. */
export interface PrMergeArgs {
    pr: string;
    mergeMethod?: 'merge' | 'squash' | 'rebase';
    commitTitle?: string;
    commitMessage?: string;
    deleteBranch?: boolean;
}
/** Narrow structural view of a merged-PR canonical value. */
export interface MergedPrValue {
    status: 'merged';
    merged: boolean;
    sha?: string;
    message: string;
    url: string;
    branchDeleted: boolean;
    rateLimit: RateLimitValueView;
}
/** Pending card for pr_merge. */
export declare function prMergeCall(args: PrMergeArgs): ToolCallView;
/** Completed card for pr_merge: the merge result, or a readable failure. */
export declare function prMergeResult(_args: PrMergeArgs, result: ToolResult): ToolResultView | undefined;
/** Narrow structural view of pr_update arguments. */
export interface PrUpdateArgs {
    pr: string;
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    base?: string;
}
/** Narrow structural view of an updated-PR canonical value. */
export interface UpdatedPrValue {
    status: 'updated';
    url: string;
    number: number;
    title: string;
    state: string;
    base: string;
    rateLimit: RateLimitValueView;
}
/** Pending card for pr_update. */
export declare function prUpdateCall(args: PrUpdateArgs): ToolCallView;
/** Completed card for pr_update. */
export declare function prUpdateResult(_args: PrUpdateArgs, result: ToolResult): ToolResultView | undefined;
/** Narrow structural view of gh_repo arguments. */
export interface GhRepoArgs {
    ownerRepo?: string;
}
/** Narrow structural view of the gh_repo canonical value. */
export interface RepoValue {
    repo: string;
    description: string;
    defaultBranch: string;
    visibility: string;
    stars: number;
    forks: number;
    openIssues: number;
    language: string;
    license: string;
    topics: string[];
    url: string;
    updatedAt: string;
    rateLimit: RateLimitValueView;
}
/** Pending card for gh_repo. */
export declare function ghRepoCall(args: GhRepoArgs): ToolCallView;
/** Completed card for gh_repo. */
export declare function ghRepoResult(_args: GhRepoArgs, result: ToolResult): ToolResultView | undefined;
/** Narrow structural view of gh_file arguments. */
export interface GhFileArgs {
    ownerRepo?: string;
    path: string;
    ref?: string;
    maxChars?: number;
}
/** Narrow structural view of the gh_file canonical value. */
export interface FileValue {
    repo: string;
    path: string;
    ref: string;
    size: number;
    truncated: boolean;
    content: string;
    sha: string;
    url: string;
    rateLimit: RateLimitValueView;
}
/** Pending card for gh_file. */
export declare function ghFileCall(args: GhFileArgs): ToolCallView;
/** Completed card for gh_file: first lines plus size facts. */
export declare function ghFileResult(_args: GhFileArgs, result: ToolResult): ToolResultView | undefined;
/** Narrow structural view of ci_run arguments. */
export interface CiRunArgs {
    task: 'review' | 'analyze' | 'publish';
    pr: string;
    ownerRepo?: string;
    maxDiffChars?: number;
    body?: string;
    findings?: Array<{
        file: string;
        line?: number | null;
        severity: 'info' | 'warning' | 'error';
        rule: string;
        message: string;
    }>;
    postComments?: boolean;
    postCheck?: boolean;
}
/** Narrow structural view of the ci_run canonical value. */
export interface CiRunValueView {
    status: 'ok';
    repo: string;
    pr: number;
    headSha: string;
    verdict: 'pass' | 'needs-changes' | 'skipped';
    engine: 'static' | 'model';
    findings: Array<{
        file: string;
        line: number | null;
        severity: string;
        rule: string;
        message: string;
    }>;
    summary: string;
    truncated: boolean;
    alreadyReviewed: boolean;
    diffText?: string;
    checkRun?: {
        id: number;
        url: string;
        conclusion: string;
    };
    review?: {
        url: string;
        inlineComments: number;
    };
    files?: {
        json: string;
        markdown: string;
    };
    rateLimit: RateLimitValueView;
}
/** Pending card for ci_run. */
export declare function ciRunCall(args: CiRunArgs): ToolCallView;
/** Completed card for ci_run: verdict plus the check link. */
export declare function ciRunResult(_args: CiRunArgs, result: ToolResult): ToolResultView | undefined;
//# sourceMappingURL=present.d.ts.map