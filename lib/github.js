/** Domain failure of one GitHub API request, token-free by construction. */
export class GithubError extends Error {
    status;
    rateLimit;
    constructor(status, message, rateLimit) {
        super(message);
        this.name = 'GithubError';
        this.status = status;
        this.rateLimit = rateLimit;
    }
}
const JSON_ACCEPT = 'application/vnd.github+json';
const API_VERSION = '2022-11-28';
const USER_AGENT = 'dsh-github';
function rateLimitFromHeaders(headers) {
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    const remainingNum = remaining === null ? null : Number(remaining);
    const resetNum = reset === null ? null : Number(reset);
    return {
        remaining: remainingNum !== null && Number.isFinite(remainingNum) ? remainingNum : null,
        resetAt: resetNum !== null && Number.isFinite(resetNum) ? resetNum * 1000 : null,
    };
}
/** Retry delay for a 429 response: Retry-After seconds or reset-epoch, else backoff. */
function retryDelayMs(headers, attempt, options) {
    const retryAfter = headers.get('retry-after');
    if (retryAfter !== null) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds) && seconds >= 0)
            return Math.min(seconds * 1000, options.retryMaxWaitMs);
    }
    const reset = headers.get('x-ratelimit-reset');
    if (reset !== null) {
        const until = Number(reset) * 1000 - Date.now();
        if (Number.isFinite(until) && until > 0)
            return Math.min(until, options.retryMaxWaitMs);
    }
    return Math.min(options.retryBaseMs * 2 ** attempt, options.retryMaxWaitMs);
}
/** Wait while still honoring the caller's abort signal. */
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        const aborter = signal ?? null;
        if (aborter?.aborted === true) {
            reject(aborter.reason instanceof Error ? aborter.reason : new Error('aborted'));
            return;
        }
        const timer = setTimeout(done, ms);
        aborter?.addEventListener('abort', onAbort, { once: true });
        function done() {
            aborter?.removeEventListener('abort', onAbort);
            resolve();
        }
        function onAbort() {
            clearTimeout(timer);
            reject(aborter?.reason instanceof Error ? aborter.reason : new Error('aborted'));
        }
    });
}
/**
 * Authenticated GitHub REST client with 429 retry.
 *
 * Retries honor Retry-After / x-ratelimit-reset and the caller's signal;
 * non-2xx responses surface as {@link GithubError} carrying the status and
 * current rate-limit facts. Errors never contain the token.
 */
export class GithubClient {
    token;
    options;
    constructor(token, options) {
        this.token = token;
        this.options = options;
    }
    /** One JSON request with retry; `GithubError` on any non-2xx status. */
    async requestJson(method, path, options = {}) {
        const response = await this.request(method, path, { ...options, accept: options.accept ?? JSON_ACCEPT });
        const rateLimit = rateLimitFromHeaders(response.headers);
        if (!response.ok) {
            let message = `GitHub API ${response.status} for ${method} ${path}`;
            try {
                const parsed = await response.json();
                if (typeof parsed.message === 'string' && parsed.message.length > 0)
                    message = parsed.message;
            }
            catch {
                // Non-JSON error body: keep the status-based message.
            }
            throw new GithubError(response.status, message, rateLimit);
        }
        const data = await response.json();
        return { status: response.status, data, rateLimit };
    }
    /** One text request (the diff media type) with retry. */
    async requestText(method, path, options = {}) {
        const response = await this.request(method, path, { ...options, accept: 'application/vnd.github.diff' });
        const rateLimit = rateLimitFromHeaders(response.headers);
        if (!response.ok) {
            let message = `GitHub API ${response.status} for ${method} ${path}`;
            try {
                const parsed = await response.json();
                if (typeof parsed.message === 'string' && parsed.message.length > 0)
                    message = parsed.message;
            }
            catch {
                // Non-JSON error body: keep the status-based message.
            }
            throw new GithubError(response.status, message, rateLimit);
        }
        return { text: await response.text(), rateLimit };
    }
    /** Fetch with Authorization, 429 retry, and signal handling. */
    async request(method, path, options) {
        let attempt = 0;
        for (;;) {
            let response;
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
                    signal: options.signal,
                });
            }
            catch (error) {
                if (options.signal?.aborted)
                    throw options.signal.reason instanceof Error ? options.signal.reason : new Error('aborted');
                throw error;
            }
            if (response.status !== 429 || attempt >= this.options.maxRetries)
                return response;
            await sleep(retryDelayMs(response.headers, attempt, this.options), options.signal);
            attempt += 1;
        }
    }
}
/** Build a client from config; resolves the base URL once. */
export function clientOptionsFromConfig(config, fetchImpl) {
    return {
        apiBaseUrl: config.apiBaseUrl.replace(/\/+$/, ''),
        maxRetries: config.maxRetries,
        retryBaseMs: config.retryBaseMs,
        retryMaxWaitMs: config.retryMaxWaitMs,
        fetchImpl: fetchImpl ?? globalThis.fetch.bind(globalThis),
    };
}
//# sourceMappingURL=github.js.map