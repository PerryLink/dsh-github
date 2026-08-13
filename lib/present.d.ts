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
import type { JsonValue } from '@deepseek-ai/dsh-session';
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
}
/** Narrow structural view of the shared error canonical value. */
export interface GithubErrorValue {
    status: 'error';
    code: string;
    message: string;
    guidance?: string;
}
/** Pending card for pr_create. */
export declare function prCreateCall(args: PrCreateArgs): ToolCallView;
/** Completed card for pr_create: the PR link, or a readable failure. */
export declare function prCreateResult(_args: PrCreateArgs, result: ToolResult): ToolResultView | undefined;
/** Narrow structural view of review_post arguments. */
export interface ReviewPostArgs {
    jobId: string;
}
/** Narrow structural view of a posted-review canonical value. */
export interface PostedReviewValue {
    status: 'posted';
    url: string;
    commentId: number;
    findings: number;
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
}
/** Pending card for issue_open. */
export declare function issueOpenCall(args: IssueOpenArgs): ToolCallView;
/** Completed card for issue_open. */
export declare function issueOpenResult(_args: IssueOpenArgs, result: ToolResult): ToolResultView | undefined;
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
        runs?: Array<{
            name: string;
            status: string;
            conclusion?: string;
        }>;
    };
    comments?: Array<{
        id: number;
        user: string;
        path?: string;
        line?: number;
        body: string;
    }>;
    findings?: FindingValue[];
    diff: {
        length: number;
        truncated: boolean;
        excerpt: string;
        files?: Array<{
            path: string;
            added: number;
            removed: number;
        }>;
    };
    rateLimit: {
        remaining?: number | null;
        resetAt?: number | null;
    };
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
    rateLimit: {
        remaining?: number | null;
        resetAt?: number | null;
    };
}
/** Pending card for gh_issue. */
export declare function ghIssueCall(args: GhIssueArgs): ToolCallView;
/** Completed card for gh_issue. */
export declare function ghIssueResult(_args: GhIssueArgs, result: ToolResult): ToolResultView | undefined;
/** Identity projection: persist the whole canonical value for card replay. */
export declare function identityMeta(_args: unknown, value: JsonValue): JsonValue;
//# sourceMappingURL=present.d.ts.map