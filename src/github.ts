/**
 * Minimal GitHub REST client: JSON requests with 429/403 rate-limit
 * backoff-retry and rate-limit surfacing, plus the
 * `application/vnd.github.diff` text endpoint.
 *
 * The token travels only in the Authorization header of outgoing requests;
 * request bodies, error messages, and returned values never contain it.
 * @module dsh-github/github
 */
import type { Config } from './config.ts'

/** GitHub rate-limit facts, surfaced to the model on every read result. */
export interface RateLimitInfo {
  remaining: number | null
  /** Epoch ms when the window resets; null when the response omitted it. */
  resetAt: number | null
}

/** Domain failure of one GitHub API request, token-free by construction. */
export class GithubError extends Error {
  readonly status: number
  readonly rateLimit: RateLimitInfo

  constructor(status: number, message: string, rateLimit: RateLimitInfo) {
    super(message)
    this.name = 'GithubError'
    this.status = status
    this.rateLimit = rateLimit
  }
}

/** Successful JSON response with its rate-limit facts. */
export interface GithubJsonResponse<T> {
  status: number
  data: T
  rateLimit: RateLimitInfo
}

export interface GithubRequestOptions {
  /** JSON body for writes. */
  body?: unknown
  /** Override the Accept header (e.g. the diff media type). */
  accept?: string
  signal?: AbortSignal
}

interface ClientOptions {
  apiBaseUrl: string
  maxRetries: number
  retryBaseMs: number
  retryMaxWaitMs: number
  /** Hard per-request deadline; aborts the fetch when exceeded. */
  requestTimeoutMs: number
  fetchImpl: typeof fetch
}

const JSON_ACCEPT = 'application/vnd.github+json'
const API_VERSION = '2022-11-28'
const USER_AGENT = 'dsh-github'

/** Methods safe to retry on network failures and 5xx responses (reads only; writes stay idempotent). */
const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD'])

function rateLimitFromHeaders(headers: Headers): RateLimitInfo {
  const remaining = headers.get('x-ratelimit-remaining')
  const reset = headers.get('x-ratelimit-reset')
  const remainingNum = remaining === null ? null : Number(remaining)
  const resetNum = reset === null ? null : Number(reset)
  return {
    remaining: remainingNum !== null && Number.isFinite(remainingNum) ? remainingNum : null,
    resetAt: resetNum !== null && Number.isFinite(resetNum) ? resetNum * 1000 : null,
  }
}

/** Retry delay for a 429 response: Retry-After seconds or reset-epoch, else backoff. */
function retryDelayMs(headers: Headers, attempt: number, options: ClientOptions): number {
  const retryAfter = headers.get('retry-after')
  if (retryAfter !== null) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, options.retryMaxWaitMs)
  }
  const reset = headers.get('x-ratelimit-reset')
  if (reset !== null) {
    const until = Number(reset) * 1000 - Date.now()
    if (Number.isFinite(until) && until > 0) return Math.min(until, options.retryMaxWaitMs)
  }
  return Math.min(options.retryBaseMs * 2 ** attempt, options.retryMaxWaitMs)
}

/** Wait while still honoring the caller's abort signal. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const aborter: AbortSignal | null = signal ?? null
    if (aborter?.aborted === true) {
      reject(aborter.reason instanceof Error ? aborter.reason : new Error('aborted'))
      return
    }
    const timer = setTimeout(done, ms)
    aborter?.addEventListener('abort', onAbort, { once: true })
    function done(): void {
      aborter?.removeEventListener('abort', onAbort)
      resolve()
    }
    function onAbort(): void {
      clearTimeout(timer)
      reject(aborter?.reason instanceof Error ? aborter.reason : new Error('aborted'))
    }
  })
}

/**
 * Shared authenticated transport over the GitHub API. It owns the
 * Authorization header, the per-request timeout, and the 429/403 rate-limit
 * retry loop; the REST and GraphQL clients both delegate here, so they share
 * one token, one timeout, and one backoff policy. Errors never contain the
 * token.
 */
export class GithubTransport {
  constructor(
    private readonly token: string,
    private readonly options: ClientOptions,
  ) {}

  /** Fetch with Authorization, timeout, and retry (429/403 rate limits always; reads also on network errors and 5xx). */
  async request(method: string, path: string, options: GithubRequestOptions): Promise<Response> {
    let attempt = 0
    for (;;) {
      const timeoutSignal = AbortSignal.timeout(this.options.requestTimeoutMs)
      const signal = options.signal === undefined ? timeoutSignal : AbortSignal.any([options.signal, timeoutSignal])
      let response: Response
      try {
        response = await this.options.fetchImpl(new URL(path, this.options.apiBaseUrl), {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: options.accept ?? JSON_ACCEPT,
            'X-GitHub-Api-Version': API_VERSION,
            'User-Agent': USER_AGENT,
            ...options.body !== undefined ? { 'Content-Type': 'application/json' } : {},
          },
          ...options.body !== undefined ? { body: JSON.stringify(options.body) } : {},
          signal,
        })
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason instanceof Error ? options.signal.reason : new Error('aborted')
        // A deadline exceeded or a transport failure is retryable for safe
        // (read) methods only; a caller abort above always fails fast.
        if (SAFE_RETRY_METHODS.has(method) && attempt < this.options.maxRetries) {
          await sleep(Math.min(this.options.retryBaseMs * 2 ** attempt, this.options.retryMaxWaitMs), options.signal)
          attempt += 1
          continue
        }
        throw error
      }
      // Retry primary (429) and secondary (403 + Retry-After) rate limits for
      // every method, plus transient 5xx responses for safe read methods; a
      // 403 without Retry-After is a permission denial and must fail fast.
      const retryable =
        response.status === 429
        || (response.status === 403 && response.headers.get('retry-after') !== null)
        || (SAFE_RETRY_METHODS.has(method) && (response.status === 502 || response.status === 503 || response.status === 504))
      if (!retryable || attempt >= this.options.maxRetries) return response
      await sleep(retryDelayMs(response.headers, attempt, this.options), options.signal)
      attempt += 1
    }
  }
}

/**
 * Authenticated GitHub REST client: JSON/text requests with the shared
 * transport's 429/403 backoff-retry and rate-limit surfacing.
 */
export class GithubClient {
  private readonly transport: GithubTransport

  constructor(token: string, options: ClientOptions) {
    this.transport = new GithubTransport(token, options)
  }

  /** One JSON request with retry; `GithubError` on any non-2xx status. */
  async requestJson<T>(method: string, path: string, options: GithubRequestOptions = {}): Promise<GithubJsonResponse<T>> {
    const response = await this.transport.request(method, path, { ...options, accept: options.accept ?? JSON_ACCEPT })
    const rateLimit = rateLimitFromHeaders(response.headers)
    if (!response.ok) {
      let message = `GitHub API ${response.status} for ${method} ${path}`
      try {
        const parsed = await response.json() as { message?: unknown }
        if (typeof parsed.message === 'string' && parsed.message.length > 0) message = parsed.message
      } catch {
        // Non-JSON error body: keep the status-based message.
      }
      throw new GithubError(response.status, message, rateLimit)
    }
    if (response.status === 204) return { status: response.status, data: undefined as T, rateLimit }
    const data = await response.json() as T
    return { status: response.status, data, rateLimit }
  }

  /** One text request (the diff media type) with retry. */
  async requestText(method: string, path: string, options: GithubRequestOptions = {}): Promise<{ text: string; rateLimit: RateLimitInfo }> {
    const response = await this.transport.request(method, path, { ...options, accept: 'application/vnd.github.diff' })
    const rateLimit = rateLimitFromHeaders(response.headers)
    if (!response.ok) {
      let message = `GitHub API ${response.status} for ${method} ${path}`
      try {
        const parsed = await response.json() as { message?: unknown }
        if (typeof parsed.message === 'string' && parsed.message.length > 0) message = parsed.message
      } catch {
        // Non-JSON error body: keep the status-based message.
      }
      throw new GithubError(response.status, message, rateLimit)
    }
    return { text: await response.text(), rateLimit }
  }
}

/** Successful GraphQL response with its rate-limit facts. */
export interface GithubGraphqlResponse<T> {
  data: T
  rateLimit: RateLimitInfo
}

/**
 * Authenticated GitHub GraphQL client over the shared transport. One POST to
 * `/graphql` carries a document; `query` sends a single document and `batch`
 * merges several aliased sub-queries into one request, sharing the transport's
 * token, timeout, and 429 backoff with the REST client.
 */
export class GithubGraphqlClient {
  private readonly transport: GithubTransport

  constructor(token: string, options: ClientOptions) {
    this.transport = new GithubTransport(token, options)
  }

  /**
   * Run one GraphQL document. A non-2xx response or a GraphQL `errors` payload
   * fails loud as a {@link GithubError}; the token never appears in messages.
   * @param document - the GraphQL query/mutation document.
   * @param variables - optional variables.
   * @param signal - optional abort signal.
   * @returns the `data` plus rate-limit facts.
   */
  async query<T>(document: string, variables: Record<string, unknown> = {}, signal?: AbortSignal): Promise<GithubGraphqlResponse<T>> {
    const response = await this.transport.request('POST', '/graphql', { body: { query: document, variables }, accept: JSON_ACCEPT, signal })
    const rateLimit = rateLimitFromHeaders(response.headers)
    if (!response.ok) {
      let message = `GitHub API ${response.status} for POST /graphql`
      try {
        const parsed = await response.json() as { message?: unknown }
        if (typeof parsed.message === 'string' && parsed.message.length > 0) message = parsed.message
      } catch {
        // Non-JSON error body: keep the status-based message.
      }
      throw new GithubError(response.status, message, rateLimit)
    }
    const payload = await response.json() as { data?: T; errors?: Array<{ message?: unknown }> }
    const firstError = payload.errors?.find(error => typeof error.message === 'string' && error.message.length > 0)?.message
    if (typeof firstError === 'string') {
      throw new GithubError(200, `GraphQL error: ${firstError}`, rateLimit)
    }
    if (payload.data === undefined || payload.data === null) {
      throw new GithubError(200, 'GraphQL query returned no data', rateLimit)
    }
    return { data: payload.data, rateLimit }
  }

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
  async batch<T>(aliases: Record<string, string>, variables: Record<string, unknown> = {}, signal?: AbortSignal): Promise<GithubGraphqlResponse<Record<string, T>>> {
    const fields = Object.entries(aliases).map(([alias, field]) => `${alias}: ${field}`).join('\n')
    return this.query<Record<string, T>>(`query { ${fields} }`, variables, signal)
  }
}

/** Build a client from config; resolves the base URL once. */
export function clientOptionsFromConfig(config: Config, fetchImpl?: typeof fetch): ClientOptions {
  return {
    apiBaseUrl: config.apiBaseUrl.replace(/\/+$/, ''),
    maxRetries: config.maxRetries,
    retryBaseMs: config.retryBaseMs,
    retryMaxWaitMs: config.retryMaxWaitMs,
    requestTimeoutMs: config.requestTimeoutMs,
    fetchImpl: fetchImpl ?? globalThis.fetch.bind(globalThis),
  }
}
