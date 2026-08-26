import { describe, expect, it } from 'vitest'
import { GithubError, GithubGraphqlClient, clientOptionsFromConfig } from '../src/github.ts'
import { Config } from '../src/index.ts'
import { TOKEN, jsonResponse, stubFetch } from './helpers.ts'

const options = clientOptionsFromConfig(Config({ retryBaseMs: 1, retryMaxWaitMs: 10_000 }) as never)

describe('GithubGraphqlClient', () => {
  it('sends one GraphQL document with the Authorization header and returns data + rate limit', async () => {
    let seen: RequestInit | undefined
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      seen = init
      return jsonResponse(200, { data: { search: { repositoryCount: 2 } } }, { 'x-ratelimit-remaining': '10' })
    }) as typeof fetch
    const client = new GithubGraphqlClient(TOKEN, { ...options, fetchImpl })
    const response = await client.query<{ search: { repositoryCount: number } }>('query($q: String!) { search(query: $q, type: REPOSITORY) { repositoryCount } }', { q: 'dsh' })
    expect(response.data.search.repositoryCount).toBe(2)
    expect(response.rateLimit.remaining).toBe(10)
    const headers = seen?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
    const body = JSON.parse(String(seen?.body)) as { query: string; variables: Record<string, string> }
    expect(body.variables).toEqual({ q: 'dsh' })
  })

  it('surfaces a GraphQL errors payload as a GithubError without the token', async () => {
    const fetchImpl = stubFetch([{
      match: (_m, url) => url.pathname === '/graphql',
      respond: () => jsonResponse(200, { errors: [{ message: 'Field "x" is not defined' }] }),
    }])
    const client = new GithubGraphqlClient(TOKEN, { ...options, fetchImpl })
    const error = await client.query('{ x }').catch(error => error)
    expect(error).toBeInstanceOf(GithubError)
    expect(error.status).toBe(200)
    expect(error.message).toBe('GraphQL error: Field "x" is not defined')
    expect(JSON.stringify(error)).not.toContain(TOKEN)
  })

  it('surfaces a non-2xx GraphQL response as a GithubError', async () => {
    const fetchImpl = stubFetch([{
      match: (_m, url) => url.pathname === '/graphql',
      respond: () => jsonResponse(401, { message: 'Bad credentials' }),
    }])
    const client = new GithubGraphqlClient(TOKEN, { ...options, fetchImpl })
    const error = await client.query('{ x }').catch(error => error)
    expect(error).toBeInstanceOf(GithubError)
    expect(error.status).toBe(401)
  })

  it('retries a 429 rate limit through the shared transport', async () => {
    let calls = 0
    const fetchImpl = stubFetch([{
      match: (_m, url) => url.pathname === '/graphql',
      respond: () => {
        calls += 1
        return calls < 2
          ? jsonResponse(429, { message: 'rate limited' }, { 'retry-after': '0' })
          : jsonResponse(200, { data: { ok: true } })
      },
    }])
    const client = new GithubGraphqlClient(TOKEN, { ...options, fetchImpl })
    const response = await client.query<{ ok: boolean }>('{ ok }')
    expect(response.data.ok).toBe(true)
    expect(calls).toBe(2)
  })

  it('batches aliased sub-queries into one request and maps results by alias', async () => {
    let seenBody: Record<string, unknown> | undefined
    const fetchImpl = stubFetch([{
      match: (_m, url) => url.pathname === '/graphql',
      respond: (init) => {
        seenBody = JSON.parse(String(init?.body)) as Record<string, unknown>
        return jsonResponse(200, { data: { first: { id: 1 }, second: { id: 2 } } })
      },
    }])
    const client = new GithubGraphqlClient(TOKEN, { ...options, fetchImpl })
    const response = await client.batch<{ id: number }>({
      first: 'repository(owner:"o", name:"a") { id }',
      second: 'repository(owner:"o", name:"b") { id }',
    })
    expect(response.data).toEqual({ first: { id: 1 }, second: { id: 2 } })
    const document = String(seenBody?.query ?? '')
    expect(document).toContain('first: repository')
    expect(document).toContain('second: repository')
  })
})
