import type { GithubAgent, GithubJobId, JobRegistry } from './types.ts';
import type { GithubState } from './state.ts';
/** Producer kind — also the `<kind>-N` id prefix; the host treats it as opaque. */
export declare const REVIEW_JOB_KIND = "github-review";
export interface StartReviewJobInput {
    repo: string;
    pr: number;
    label: string;
    owner: GithubAgent;
    /** Present in tests where no job registry exists; disables registration. */
    timeoutMs?: number;
}
/**
 * Start one background review job and register its in-memory record.
 *
 * The token is resolved inside the run body (per-operation, per the
 * credentials-seam contract); a missing token settles the job as `failed`
 * with configuration guidance, never with a token value.
 * @param registry - `ctx.jobs` of the hosting context.
 * @param state - plugin state holding config, token resolution, and records.
 * @param input - target PR, label, and owning agent.
 * @returns the registry-issued `<kind>-N` id.
 */
export declare function startReviewJob(registry: JobRegistry, state: GithubState, input: StartReviewJobInput): GithubJobId;
//# sourceMappingURL=jobs.d.ts.map