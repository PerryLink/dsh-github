import { describe, expect, it } from 'vitest'
import { GithubClient, GithubError, clientOptionsFromConfig } from '../src/github.ts'
import { Config } from '../src/index.ts'
import { TOKEN, jsonResponse, stubFetch } from './helpers.ts'

const options = clientOptionsFromConfig(Config({ retryBaseMs: 1, retryMaxWaitMs: 10_000 }) as never)

describe('GithubClient 429 retry', () => {
  it('retries on 429 honoring Retry-After and eventually succeeds', async () => {
    let calls = 0
    const fetchImpl = stubFetch([{
      match: () => true,
      respond: () => {
        calls += 1
        return calls < 3
          ? jsonResponse(429, { message: 'rate limited' }, { 'retry-after': '0' })
          : jsonResponse(200, { ok: true }, { 'x-ratelimit-remaining': '42', 'x-ratelimit-reset': '2000000000' })
      },
    }])
    const client = new GithubClient(TOKEN, { ...options, fetchImpl })
    const response = await client.requestJson<{ ok: boolean }>('GET', '/repos/o/r')
    expect(response.data).toEqual({ ok: true })
    expect(calls).toBe(3)
    expect(response.rateLimit).toEqual({ remaining: 42, resetAt: 2_000_000_000_000 })
  })

  it('gives up after maxRetries and surfaces the rate-limit facts', async () => {
    let calls = 0
    const fetchImpl = stubFetch([{
      match: () => true,
      respond: () => {
        calls += 1
        return jsonResponse(429, { message: 'rate limited' }, { 'retry-after': '0', 'x-ratelimit-remaining': '0' })
      },
    }])
    const client = new GithubClient(TOKEN, { ...options, fetchImpl })
    const error = await client.requestJson('GET', '/repos/o/r').catch(error => error)
    expect(error).toBeInstanceOf(GithubError)
    expect(error.status).toBe(429)
    expect(calls).toBe(4) // first attempt + maxRetries (3)
    expect(error.rateLimit.remaining).toBe(0)
  })

  it('aborts a pending retry sleep when the signal fires', async () => {
    const controller = new AbortController()
    const fetchImpl = stubFetch([{
      match: () => true,
      respond: () => jsonResponse(429, { message: 'slow down' }, { 'retry-after': '60' }),
    }])
    const client = new GithubClient(TOKEN, { ...options, fetchImpl })
    const pending = client.requestJson('GET', '/repos/o/r', { signal: controller.signal }).catch(error => error)
    controller.abort(new Error('caller cancelled'))
    const error = await pending
    expect(error).toBeInstanceOf(Error)
    expect(String(error.message)).toContain('caller cancelled')
  })

  it('surfaces a GitHub error body without the token', async () => {
    const fetchImpl = stubFetch([{
      match: () => true,
      respond: () => jsonResponse(401, { message: 'Bad credentials' }),
    }])
    const client = new GithubClient(TOKEN, { ...options, fetchImpl })
    const error = await client.requestJson('GET', '/repos/o/r').catch(error => error)
    expect(error).toBeInstanceOf(GithubError)
    expect(error.status).toBe(401)
    expect(error.message).toBe('Bad credentials')
    expect(JSON.stringify(error)).not.toContain(TOKEN)
  })

  it('sends the token only in the Authorization header', async () => {
    let seen: RequestInit | undefined
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      seen = init
      return jsonResponse(200, { ok: true })
    }) as typeof fetch
    const client = new GithubClient(TOKEN, { ...options, fetchImpl })
    await client.requestJson('GET', '/repos/o/r')
    const headers = seen?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28')
    expect(seen?.body).toBeUndefined()
  })

  it('returns diff text through the diff media type', async () => {
    const fetchImpl = stubFetch([{
      match: (method, url) => method === 'GET' && url.pathname === '/repos/o/r/pulls/1',
      respond: () => new Response('diff --git a/a.ts b/a.ts', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    }])
    const client = new GithubClient(TOKEN, { ...options, fetchImpl })
    const result = await client.requestText('GET', '/repos/o/r/pulls/1')
    expect(result.text).toContain('diff --git')
  })
})
