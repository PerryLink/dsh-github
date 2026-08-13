/**
 * Minimal GitHub REST client: JSON requests with 429 backoff-retry and
 * rate-limit surfacing, plus the `application/vnd.github.diff` text endpoint.
 *
 * The token travels only in the Authorization header of outgoing requests;
 * request bodies, error messages, and returned values never contain it.
 * @module dsh-github/github
 */
import type { Config } from './config.ts';
/** GitHub rate-limit facts, surfaced to the model on every read result. */
export interface RateLimitInfo {
    remaining: number | null;
    /** Epoch ms when the window resets; null when the response omitted it. */
    resetAt: number | null;
}
/** Domain failure of one GitHub API request, token-free by construction. */
export declare class GithubError extends Error {
    readonly status: number;
    readonly rateLimit: RateLimitInfo;
    constructor(status: number, message: string, rateLimit: RateLimitInfo);
}
/** Successful JSON response with its rate-limit facts. */
export interface GithubJsonResponse<T> {
    status: number;
    data: T;
    rateLimit: RateLimitInfo;
}
export interface GithubRequestOptions {
    /** JSON body for writes. */
    body?: unknown;
    /** Override the Accept header (e.g. the diff media type). */
    accept?: string;
    signal?: AbortSignal;
}
interface ClientOptions {
    apiBaseUrl: string;
    maxRetries: number;
    retryBaseMs: number;
    retryMaxWaitMs: number;
    fetchImpl: typeof fetch;
}
/**
 * Authenticated GitHub REST client with 429 retry.
 *
 * Retries honor Retry-After / x-ratelimit-reset and the caller's signal;
 * non-2xx responses surface as {@link GithubError} carrying the status and
 * current rate-limit facts. Errors never contain the token.
 */
export declare class GithubClient {
    private readonly token;
    private readonly options;
    constructor(token: string, options: ClientOptions);
    /** One JSON request with retry; `GithubError` on any non-2xx status. */
    requestJson<T>(method: string, path: string, options?: GithubRequestOptions): Promise<GithubJsonResponse<T>>;
    /** One text request (the diff media type) with retry. */
    requestText(method: string, path: string, options?: GithubRequestOptions): Promise<{
        text: string;
        rateLimit: RateLimitInfo;
    }>;
    /** Fetch with Authorization, 429 retry, and signal handling. */
    private request;
}
/** Build a client from config; resolves the base URL once. */
export declare function clientOptionsFromConfig(config: Config, fetchImpl?: typeof fetch): ClientOptions;
export {};
//# sourceMappingURL=github.d.ts.map