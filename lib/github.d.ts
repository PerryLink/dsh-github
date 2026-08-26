/**
 * Minimal GitHub REST client: JSON requests with 429/403 rate-limit
 * backoff-retry and rate-limit surfacing, plus the
 * `application/vnd.github.diff` text endpoint.
 *
 * The token travels only in the Authorization header of outgoing requests;
 * request bodies, error messages, and returned values never contain it.
 * @module dsh-github/github
 */
import type { Config } from './config.js';
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
    /** Hard per-request deadline; aborts the fetch when exceeded. */
    requestTimeoutMs: number;
    fetchImpl: typeof fetch;
}
/**
 * Shared authenticated transport over the GitHub API. It owns the
 * Authorization header, the per-request timeout, and the 429/403 rate-limit
 * retry loop; the REST and GraphQL clients both delegate here, so they share
 * one token, one timeout, and one backoff policy. Errors never contain the
 * token.
 */
export declare class GithubTransport {
    private readonly token;
    private readonly options;
    constructor(token: string, options: ClientOptions);
    /** Fetch with Authorization, timeout, and retry (429/403 rate limits always; reads also on network errors and 5xx). */
    request(method: string, path: string, options: GithubRequestOptions): Promise<Response>;
}
/**
 * Authenticated GitHub REST client: JSON/text requests with the shared
 * transport's 429/403 backoff-retry and rate-limit surfacing.
 */
export declare class GithubClient {
    private readonly transport;
    constructor(token: string, options: ClientOptions);
    /** One JSON request with retry; `GithubError` on any non-2xx status. */
    requestJson<T>(method: string, path: string, options?: GithubRequestOptions): Promise<GithubJsonResponse<T>>;
    /** One text request (the diff media type) with retry. */
    requestText(method: string, path: string, options?: GithubRequestOptions): Promise<{
        text: string;
        rateLimit: RateLimitInfo;
    }>;
}
/** Successful GraphQL response with its rate-limit facts. */
export interface GithubGraphqlResponse<T> {
    data: T;
    rateLimit: RateLimitInfo;
}
/**
 * Authenticated GitHub GraphQL client over the shared transport. One POST to
 * `/graphql` carries a document; `query` sends a single document and `batch`
 * merges several aliased sub-queries into one request, sharing the transport's
 * token, timeout, and 429 backoff with the REST client.
 */
export declare class GithubGraphqlClient {
    private readonly transport;
    constructor(token: string, options: ClientOptions);
    /**
     * Run one GraphQL document. A non-2xx response or a GraphQL `errors` payload
     * fails loud as a {@link GithubError}; the token never appears in messages.
     * @param document - the GraphQL query/mutation document.
     * @param variables - optional variables.
     * @param signal - optional abort signal.
     * @returns the `data` plus rate-limit facts.
     */
    query<T>(document: string, variables?: Record<string, unknown>, signal?: AbortSignal): Promise<GithubGraphqlResponse<T>>;
    /**
     * Batch several sub-queries into ONE GraphQL request using aliases. Each
     * value is a single top-level field selection (e.g.
     * `repository(owner:"o", name:"r") { id }`); the document sent is
     * `query { <alias>: <field> … }` and the result maps each alias to its data.
     * @param aliases - `alias → top-level field selection`.
     * @param variables - optional shared variables.
     * @param signal - optional abort signal.
     * @returns `{ <alias>: data, … }` plus rate-limit facts.
     */
    batch<T>(aliases: Record<string, string>, variables?: Record<string, unknown>, signal?: AbortSignal): Promise<GithubGraphqlResponse<Record<string, T>>>;
}
/** Build a client from config; resolves the base URL once. */
export declare function clientOptionsFromConfig(config: Config, fetchImpl?: typeof fetch): ClientOptions;
export {};
//# sourceMappingURL=github.d.ts.map