/**
 * Opt-in real-API smoke tests (P2-7).
 *
 * These tests self-skip unless DSH_GITHUB_E2E_TOKEN is set in the environment,
 * mirroring the harness e2e policy (real-API tests never run in CI without a
 * key). The dedicated variable keeps the unit suite hermetic: the setup file
 * removes GITHUB_TOKEN for unit tests, so the e2e gate must not read it. The
 * tests hit only read endpoints: the authenticated rate-limit window and one
 * pinned public repository's metadata. No test here performs a write or
 * mutates any account state.
 * @module dsh-github/test/e2e
 */
import { describe, expect, it } from 'vitest'
import { Config } from '../src/index.ts'
import { clientOptionsFromConfig, GithubClient } from '../src/github.ts'

const TOKEN = process.env.DSH_GITHUB_E2E_TOKEN
const HAS_TOKEN = typeof TOKEN === 'string' && TOKEN.length > 0

const client = () => {
  const config = Config({ maxRetries: 0 }) as never
  return new GithubClient(TOKEN as string, clientOptionsFromConfig(config))
}

describe.skipIf(!HAS_TOKEN)('real GitHub API smoke', () => {
  it('reports an authenticated rate-limit window', async () => {
    const response = await client().requestJson<{ rate: { remaining: number } }>('GET', '/rate_limit')
    expect(response.status).toBe(200)
    expect(response.rateLimit.remaining).not.toBeNull()
    expect(typeof response.data.rate.remaining).toBe('number')
  })

  it('reads one pinned public repository via the REST client', async () => {
    const response = await client().requestJson<{ full_name: string; default_branch: string }>('GET', '/repos/deepseek-ai/deepseek-harness')
    expect(response.status).toBe(200)
    expect(response.data.full_name).toBe('deepseek-ai/deepseek-harness')
    expect(response.data.default_branch.length).toBeGreaterThan(0)
  })

  it('reads one small file through the contents endpoint (base64 decode path)', async () => {
    const response = await client().requestJson<{ path: string; encoding?: string; content?: string; sha?: string }>(
      'GET', '/repos/deepseek-ai/deepseek-harness/contents/package.json',
    )
    expect(response.status).toBe(200)
    expect(response.data.path).toBe('package.json')
    expect(response.data.encoding).toBe('base64')
    expect(typeof response.data.content).toBe('string')
    expect(Buffer.from(response.data.content ?? '', 'base64').toString('utf8')).toContain('"name"')
  })
})
