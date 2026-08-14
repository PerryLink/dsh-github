import { type GithubState, type RateLimitValue } from './state.ts';
import { type GithubErrorValue } from './present.ts';
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
//# sourceMappingURL=tools.d.ts.map