import type { Finding } from '../review.ts';
import { type GithubState, type RateLimitValue } from '../state.ts';
/** The gate verdict: pass, needs changes, or skipped by the filters. */
export type CiVerdict = 'pass' | 'needs-changes' | 'skipped';
/** Tasks the pipeline (and the `ci_run` tool) understands. */
export type CiTask = 'review' | 'analyze' | 'publish';
export interface CheckRunValue {
    id: number;
    url: string;
    conclusion: string;
}
export interface ReviewPostValue {
    url: string;
    inlineComments: number;
}
/** Successful pipeline result — the canonical JSON the `ci_run` tool returns. */
export interface CiRunResult {
    status: 'ok';
    repo: string;
    pr: number;
    headSha: string;
    verdict: CiVerdict;
    engine: 'static' | 'model';
    findings: Finding[];
    summary: string;
    truncated: boolean;
    /** A previous run for this head commit already published its outcome. */
    alreadyReviewed: boolean;
    /** Present when the diff text was requested (analyze task). */
    diffText?: string;
    checkRun?: CheckRunValue;
    review?: ReviewPostValue;
    files?: {
        json: string;
        markdown: string;
    };
    rateLimit: RateLimitValue;
}
/** Structured failure — token-free by construction. */
export interface CiRunError {
    status: 'error';
    code: string;
    message: string;
    guidance?: string;
    rateLimit?: RateLimitValue;
}
export type CiRunOutcome = CiRunResult | CiRunError;
export interface CiRunOptions {
    repo: string;
    pr: number;
    task: CiTask;
    /** Diff cap for this run; defaults to the plugin config. */
    maxDiffChars?: number;
    /** Review-body override (model-authored, publish task). */
    body?: string;
    /** Extra findings authored by the model (publish task); merged with static ones. */
    findings?: Finding[];
    /** Post review comments; defaults to `ci.postComments`. */
    postComments?: boolean;
    /** Publish the status check; defaults to true for review/publish. */
    postCheck?: boolean;
    signal?: AbortSignal;
}
/** First line of the review body — the idempotency marker. */
export declare function reviewMarker(headSha: string): string;
/** Whether a review body carries our marker for the given head commit. */
export declare function hasReviewMarker(body: string | undefined, headSha: string): boolean;
/** Conclude the verdict from the findings under the configured `failOn` policy. */
export declare function verdictFor(findings: readonly Finding[], failOn: 'error' | 'warning'): CiVerdict;
/** Markdown report body written next to the JSON result. */
export declare function formatMarkdownReport(result: CiRunResult, options: {
    blocking: boolean;
    checkName: string;
}): string;
/**
 * Run one CI pass over a pull request. Pure in the sense that every GitHub
 * interaction goes through the per-operation token and the shared client;
 * callers (bot, tool) own their own concurrency control.
 * @param state - shared plugin state.
 * @param options - target repo/PR, task, caps, and overrides.
 * @returns the structured outcome; failures are token-free error variants.
 */
export declare function runCiPipeline(state: GithubState, options: CiRunOptions): Promise<CiRunOutcome>;
//# sourceMappingURL=pipeline.d.ts.map