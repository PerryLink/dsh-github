import { type GithubState, type RateLimitValue } from './state.ts';
import { type GithubErrorValue } from './present.ts';
export declare const RATE_LIMIT_SCHEMA: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly remaining: {
            readonly oneOf: readonly [{
                readonly type: "number";
            }, {
                readonly type: "null";
            }];
        };
        readonly resetAt: {
            readonly oneOf: readonly [{
                readonly type: "number";
            }, {
                readonly type: "null";
            }];
        };
    };
    readonly required: true;
};
export declare const ERROR_SCHEMA: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly status: {
            readonly type: "string";
            readonly required: true;
            readonly const: "error";
        };
        readonly code: {
            readonly type: "string";
            readonly required: true;
        };
        readonly message: {
            readonly type: "string";
            readonly required: true;
        };
        readonly guidance: {
            readonly type: "string";
        };
        readonly rateLimit: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly remaining: {
                    readonly oneOf: readonly [{
                        readonly type: "number";
                    }, {
                        readonly type: "null";
                    }];
                };
                readonly resetAt: {
                    readonly oneOf: readonly [{
                        readonly type: "number";
                    }, {
                        readonly type: "null";
                    }];
                };
            };
        };
    };
};
/** Domain error canonical value, used by every tool. */
export declare function errorValue(code: string, message: string, guidance?: string, rateLimit?: RateLimitValue): GithubErrorValue;
/** `pr_create`: create a pull request (write; approval-gated upstream). */
export declare function prCreateTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `gh_review`: read a PR's metadata, diff, comments, CI, and findings. */
export declare function ghReviewTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `review_post`: publish a review job's drafted comment (write; approval-gated upstream). */
export declare function reviewPostTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `gh_issue`: read issues (list / get / comments). Read-only. */
export declare function ghIssueTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `issue_open`: create an issue (write; approval-gated upstream). */
export declare function issueOpenTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `issue_comment`: comment on an issue or pull request (write; approval-gated upstream). */
export declare function issueCommentTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `issue_close`: close an issue (write; approval-gated upstream). */
export declare function issueCloseTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `gh_search`: search issues and pull requests (read; uses the search quota). */
export declare function ghSearchTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `pr_merge`: merge a pull request (write; approval-gated upstream). */
export declare function prMergeTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `pr_update`: edit a pull request (write; approval-gated upstream). */
export declare function prUpdateTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `gh_repo`: read one repository's metadata (read; concurrency-safe). */
export declare function ghRepoTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `gh_file`: read one file from a repository (read; concurrency-safe). */
export declare function ghFileTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
//# sourceMappingURL=tools.d.ts.map