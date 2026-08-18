import type { GithubAgent, GithubJobId, JobRegistry } from './types.js';
import type { GithubState } from './state.js';
/** Producer kind — also the `<kind>-N` id prefix; the host treats it as opaque. */
export declare const REVIEW_JOB_KIND = "github-review";
export interface StartReviewJobInput {
    repo: string;
    pr: number;
    label: string;
    owner: GithubAgent;
    /** Present in tests where no job registry exists; disables registration. */
    timeoutMs?: number;
    /** Diff cap override for this job; defaults to the plugin config. */
    maxDiffChars?: number;
    /** Fetch and report CI check runs (default true). */
    includeCi?: boolean;
    /** Fetch and count existing review comments (default true). */
    includeComments?: boolean;
}
/**
 * Start one background review job and register its in-memory record.
 *
 * The token is resolved inside the run body (per-operation, per the
 * credentials-seam contract); a missing token settles the job as `failed`
 * with configuration guidance, never with a token value. `start` throws when
 * no job controller serves the owner — callers surface that as a command
 * error. With `reviewMode: "model"`, the subagent seam must be composed or
 * this call fails loud before starting the job.
 * @param registry - `ctx.jobs` of the hosting context.
 * @param state - plugin state holding config, token resolution, and records.
 * @param input - target PR, label, owning agent, and job options.
 * @returns the registry-issued `<kind>-N` id.
 */
export declare function startReviewJob(registry: JobRegistry, state: GithubState, input: StartReviewJobInput): GithubJobId;
//# sourceMappingURL=jobs.d.ts.map