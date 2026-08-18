import type { CredentialProvider } from '@deepseek-ai/dsh-credentials';
import type { TokenSource } from './config.js';
/** A resolved non-empty token and the source layer that supplied it. */
export interface ResolvedToken {
    value: string;
    source: Exclude<TokenSource, 'auto'>;
}
/** Structured, token-free explanation of a failed resolution. */
export interface TokenResolutionError {
    code: 'no-token';
    message: string;
    guidance: string;
}
export type TokenResolution = {
    ok: true;
    token: ResolvedToken;
} | {
    ok: false;
    error: TokenResolutionError;
};
/** Runs one `gh` CLI invocation; injectable for tests. */
export type GhRunner = (args: string[], signal?: AbortSignal) => Promise<{
    stdout: string;
}>;
/** Run the real `gh` CLI with stdout captured (never logged). */
export declare function runGhCli(args: string[], signal?: AbortSignal): Promise<{
    stdout: string;
}>;
/**
 * Resolve the GitHub token for one operation.
 *
 * `auto` order: credentials seam → `GITHUB_TOKEN`-style environment variable →
 * `gh` CLI logged-in token. An explicit source restricts to that one source.
 * @param credentials - the credentials seam (`ctx.credentials`).
 * @param tokenSource - configured lookup policy.
 * @param tokenRef - reference / environment-variable name.
 * @param runGh - `gh` CLI runner; the real one by default.
 * @param signal - aborts the `gh` lookup.
 * @returns the token with its source, or a structured error with guidance.
 */
export declare function resolveToken(credentials: CredentialProvider, tokenSource: TokenSource, tokenRef: string, runGh?: GhRunner, signal?: AbortSignal): Promise<TokenResolution>;
//# sourceMappingURL=credential.d.ts.map