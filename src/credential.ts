/**
 * GitHub token resolution across the three supported sources.
 *
 * The token value never leaves this module except through a {@link ResolvedToken}
 * handed to the REST client: it is never written into model-visible text,
 * session events, logs, or error messages. Every resolution is per operation —
 * nothing is cached across operations, so a rotated credential reaches the
 * very next call (credentials-seam contract).
 * @module dsh-github/credential
 */
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { execFile } from 'node:child_process'
import type { TokenSource } from './config.ts'

/** A resolved non-empty token and the source layer that supplied it. */
export interface ResolvedToken {
  value: string
  source: Exclude<TokenSource, 'auto'>
}

/** Structured, token-free explanation of a failed resolution. */
export interface TokenResolutionError {
  code: 'no-token'
  message: string
  guidance: string
}

export type TokenResolution = { ok: true; token: ResolvedToken } | { ok: false; error: TokenResolutionError }

/** Runs one `gh` CLI invocation; injectable for tests. */
export type GhRunner = (args: string[], signal?: AbortSignal) => Promise<{ stdout: string }>

const NO_TOKEN_GUIDANCE =
  'Configure one of: 1) a dsh credential for this reference (recommended; ' +
  '$DSH_HOME/.credentials.yaml), 2) the same-named environment variable, or ' +
  '3) `gh auth login` for the gh CLI. Set `tokenSource` in cordis.yml to pin one source.'

/** Run the real `gh` CLI with stdout captured (never logged). */
export function runGhCli(args: string[], signal?: AbortSignal): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { windowsHide: true, signal, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error)
      else resolve({ stdout })
    })
  })
}

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
export async function resolveToken(
  credentials: CredentialProvider,
  tokenSource: TokenSource,
  tokenRef: string,
  runGh: GhRunner = runGhCli,
  signal?: AbortSignal,
): Promise<TokenResolution> {
  const order: Array<Exclude<TokenSource, 'auto'>> =
    tokenSource === 'auto' ? ['credentials', 'env', 'gh'] : [tokenSource]

  for (const source of order) {
    if (source === 'credentials') {
      let ref: ReturnType<typeof credentialRef>
      try {
        ref = credentialRef(tokenRef)
      } catch {
        return { ok: false, error: { code: 'no-token', message: `credential ref "${tokenRef}" is not a valid identifier`, guidance: NO_TOKEN_GUIDANCE } }
      }
      const resolved = await credentials.resolve(ref)
      if (resolved) return { ok: true, token: { value: resolved.value, source: 'credentials' } }
      continue
    }
    if (source === 'env') {
      const value = process.env[tokenRef]
      if (value && value.length > 0) return { ok: true, token: { value, source: 'env' } }
      continue
    }
    try {
      const { stdout } = await runGh(['auth', 'token'], signal)
      const value = stdout.trim()
      if (value.length > 0) return { ok: true, token: { value, source: 'gh' } }
    } catch {
      // gh missing or not logged in: fall through to the structured error.
    }
  }

  return {
    ok: false,
    error: {
      code: 'no-token',
      message: `no GitHub token found (source: ${tokenSource === 'auto' ? 'credentials/env/gh' : tokenSource})`,
      guidance: NO_TOKEN_GUIDANCE,
    },
  }
}
