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
import type { Context } from '@deepseek-ai/cordis';
import type { GithubState } from './state.js';
/**
 * Register the approval gate. Registration is an effect: disposing the plugin
 * fiber removes the listener.
 *
 * Unattended CI runs (`DSH_GITHUB_CI_DRIVER=1`) auto-allow exactly the
 * actions listed in `ci.autoApprove` — the composite action composes that
 * allowlist for the write the pipeline needs. Interactive sessions always
 * ask, and actions missing from `allowedActions` stay denied everywhere.
 * @param ctx - plugin context; the listener lives on the shared tools pipeline.
 * @param state - plugin state used to enrich approval reasons.
 * @returns the effect disposer.
 */
export declare function registerApprovalGate(ctx: Context, state: GithubState): () => void;
//# sourceMappingURL=approval-gate.d.ts.map