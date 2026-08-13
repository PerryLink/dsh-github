import { type GithubState } from './state.ts';
import { type GithubErrorValue } from './present.ts';
/** Domain error canonical value, used by every tool. */
export declare function errorValue(code: string, message: string, guidance?: string): GithubErrorValue;
/** `pr_create`: create a pull request (write; approval-gated upstream). */
export declare function prCreateTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `gh_review`: read a PR's metadata, diff, comments, CI, and findings. */
export declare function ghReviewTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `review_post`: publish a completed review job's comment (write; approval-gated upstream). */
export declare function reviewPostTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `gh_issue`: read issues (list / get / comments). Read-only. */
export declare function ghIssueTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** `issue_open`: create an issue (write; approval-gated upstream). */
export declare function issueOpenTool(state: GithubState): import("@deepseek-ai/dsh-tools").ToolDefinition;
//# sourceMappingURL=tools.d.ts.map