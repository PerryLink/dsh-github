/**
 * Shared per-plugin-instance state handed to tools, commands, and the review
 * job: configuration, the credentials seam, the in-memory review-job records,
 * and repo / PR-reference resolution helpers.
 *
 * The records map is the only mutable state; it lives exactly as long as the
 * plugin fiber, mirroring the process-local lifetime of the host job registry,
 * and is capped by `maxReviewRecords` (oldest settled records evict first).
 * @module dsh-github/state
 */
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials';
import { GithubClient, type RateLimitInfo } from './github.js';
import { type GitRunner } from './git.js';
import { type GhRunner, type TokenResolution } from './credential.js';
import type { SubagentsService } from './types.js';
import type { ReviewReport } from './review.js';
import { type Config } from './config.js';
/** Result of resolving which repository a call targets. */
export type RepoResolution = {
    ok: true;
    repo: string;
} | {
    ok: false;
    code: string;
    message: string;
    guidance: string;
};
/** A parsed PR reference: repository (when explicit) plus the PR number. */
export interface PrRef {
    number: number;
    /** `owner/repo` when the reference names one explicitly. */
    repo?: string;
}
/** In-memory record of one background review job, keyed by job id. */
export interface ReviewJobRecord {
    status: 'running' | 'completed' | 'failed' | 'killed';
    repo: string;
    pr: number;
    /** Head-commit SHA of the reviewed PR, captured for inline review posting. */
    headSha?: string;
    /** One-line CI check summary captured by the job (when requested). */
    ciSummary?: string;
    /** Count of existing review comments captured by the job (when requested). */
    commentsCount?: number;
    report: ReviewReport | null;
    error?: string;
}
export interface GithubState {
    config: Config;
    credentials: CredentialProvider;
    /** Host subagent seam; present when composed (used by model review). */
    subagents?: SubagentsService;
    records: Map<string, ReviewJobRecord>;
    /** Read-only git runner (injectable in tests). */
    runGit: GitRunner;
    /** gh CLI runner (injectable in tests). */
    runGh: GhRunner;
    /** Resolves the token per operation; never cached across operations. */
    resolveToken(signal?: AbortSignal): Promise<TokenResolution>;
    /** Builds an authenticated client for one operation. */
    client(token: string): GithubClient;
    /** Resolves `owner/repo` from an explicit value, config, or git origin. */
    resolveRepo(ownerRepo: string | undefined, signal?: AbortSignal): Promise<RepoResolution>;
    /** Parses `123`, `#123`, `owner/repo#123`, or a pull-request URL. */
    parsePrRef(input: string): PrRef | null;
    /** Working directory for git inspection. */
    workspaceDir: string;
    /** Hostname of the configured REST API base, for origin-URL matching. */
    apiHost: string;
    /** True while this process is the composite action's CI driver (`DSH_GITHUB_CI_DRIVER=1`). */
    isCiDriver: boolean;
    /** Register one review-job record, evicting settled records past the cap. */
    rememberRecord(id: string, record: ReviewJobRecord): void;
}
/**
 * Create the shared plugin state. Called once per plugin instance (per
 * cordis.yml row); config hot-reload creates a fresh instance.
 * @param ctx - context holding the credentials seam and (optionally) the subagent seam.
 * @param config - validated configuration.
 * @param runGit - read-only git runner (injectable in tests).
 * @param runGh - gh CLI runner (injectable in tests).
 * @param fetchImpl - fetch implementation (injectable in tests).
 */
export declare function createState(ctx: {
    credentials: CredentialProvider;
    subagents?: SubagentsService;
}, config: Config, runGit: GitRunner, runGh: GhRunner, fetchImpl?: typeof fetch): GithubState;
/** Resolve the target repository: explicit value → config fallback → git origin. */
export declare function resolveRepo(state: GithubState, ownerRepo: string | undefined, signal?: AbortSignal): Promise<RepoResolution>;
/** Parses PR references: `123`, `#123`, `owner/repo#123`, or a pull URL. */
export declare function parsePrRef(input: string): PrRef | null;
/** Shared shape of rate-limit facts on tool results. */
export type RateLimitValue = {
    remaining: number | null;
    resetAt: number | null;
};
export declare function rateLimitValue(info: RateLimitInfo): RateLimitValue;
//# sourceMappingURL=state.d.ts.map