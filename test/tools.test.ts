import { describe, expect, it } from 'vitest'
import { loadPlugin, makeServices, stubFetch, jsonResponse, TOKEN, MockAgent } from './helpers.ts'

const PULL_PAYLOAD = {
  number: 7,
  title: 'feat: shiny',
  state: 'open',
  html_url: 'https://github.com/o/r/pull/7',
  additions: 12,
  deletions: 3,
  draft: false,
  user: { login: 'alice' },
  head: { ref: 'feat/shiny', sha: 'abc123' },
  base: { ref: 'main' },
}

const accept = (init?: RequestInit): string => String((init?.headers as Record<string, string> | undefined)?.Accept ?? '')

/** Routes for any owner/repo pair, keyed on the resource path. */
const DEFAULT_ROUTES = [
  { match: (m: string, u: URL) => m === 'GET' && /\/repos\/[^/]+\/[^/]+$/.test(u.pathname), respond: () => jsonResponse(200, { default_branch: 'main' }) },
  { match: (m: string, u: URL) => m === 'POST' && /\/repos\/[^/]+\/[^/]+\/pulls$/.test(u.pathname), respond: () => jsonResponse(201, PULL_PAYLOAD) },
]

async function loaded(routes = DEFAULT_ROUTES, config: Record<string, unknown> = {}) {
  const services = makeServices()
  services.credentials.values.set('GITHUB_TOKEN', TOKEN)
  await loadPlugin(services, {
    config: { defaultOwnerRepo: 'o/r', ...config },
    runGit: async (args: string[]) => {
      const joined = args.join(' ')
      if (joined.includes('rev-parse')) return { stdout: 'feat/shiny\n' }
      if (joined.includes('status')) return { stdout: '' }
      if (joined.includes('remote')) return { stdout: 'https://github.com/o/r.git\n' }
      if (joined.includes('log')) return { stdout: 'aaa111 one\n' }
      throw new Error(`unexpected git args: ${joined}`)
    },
    runGh: async () => { throw new Error('gh unused') },
    fetchImpl: stubFetch(routes),
  })
  return services
}

describe('tool registration', () => {
  it('registers all five tools', async () => {
    const services = await loaded()
    for (const name of ['pr_create', 'gh_review', 'review_post', 'gh_issue', 'issue_open']) {
      expect(services.tools.get(name).name).toBe(name)
    }
  })

  it('marks reads concurrency-safe and writes not', async () => {
    const services = await loaded()
    expect(services.tools.get('gh_review').isConcurrencySafe?.({ pr: '7' })).toBe(true)
    expect(services.tools.get('gh_issue').isConcurrencySafe?.({ action: 'list' })).toBe(true)
    expect(services.tools.get('pr_create').isConcurrencySafe?.({ title: 'x' })).toBe(false)
    expect(services.tools.get('review_post').isConcurrencySafe?.({ jobId: 'x' })).toBe(false)
    expect(services.tools.get('issue_open').isConcurrencySafe?.({ title: 'x' })).toBe(false)
  })
})

describe('pr_create tool', () => {
  it('creates a PR and returns the canonical value', async () => {
    const services = await loaded()
    const value = await services.tools.run('pr_create', { title: 'feat: shiny', body: 'desc' })
    expect(value).toMatchObject({ status: 'created', url: 'https://github.com/o/r/pull/7', number: 7, base: 'main', head: 'feat/shiny' })
  })

  it('validates required title via the compiled schema', async () => {
    const services = await loaded()
    await expect(services.tools.run('pr_create', {})).rejects.toThrowError(/title/)
  })

  it('rejects an empty title as a structured error', async () => {
    const services = await loaded()
    const value = await services.tools.run('pr_create', { title: '   ' })
    expect(value).toMatchObject({ status: 'error', code: 'invalid-args' })
  })

  it('degrades gracefully without a token', async () => {
    const services = await loaded()
    services.credentials.values.clear()
    const value = await services.tools.run('pr_create', { title: 'x' })
    expect(value).toMatchObject({ status: 'error', code: 'no-token' })
    expect((value as { guidance: string }).guidance).toContain('gh auth login')
  })

  it('defaults head to the current git branch', async () => {
    const services = await loaded()
    const value = await services.tools.run('pr_create', { title: 'x' })
    expect(value).toMatchObject({ head: 'feat/shiny' })
  })

  it('honors an explicit head/base/ownerRepo', async () => {
    let postedBody: string | undefined
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
        if (url.pathname === '/repos/p/q/pulls' && init?.method === 'POST') {
          postedBody = String(init.body ?? '')
          return jsonResponse(201, PULL_PAYLOAD)
        }
        return jsonResponse(404, { message: 'nope' })
      }) as typeof fetch,
    })
    const value = await services.tools.run('pr_create', { title: 'x', head: 'other', base: 'dev', ownerRepo: 'p/q' })
    expect(value).toMatchObject({ status: 'created' })
    // The fixed payload mirrors the real API response; assert the request body.
    const body = JSON.parse(postedBody as string) as Record<string, unknown>
    expect(body.head).toBe('other')
    expect(body.base).toBe('dev')
    expect(body.draft).toBe(false)
  })

  it('surfaces GitHub API failures as structured errors', async () => {
    const services = await loaded([
      { match: (m: string, u: URL) => m === 'GET' && /\/repos\/[^/]+\/[^/]+$/.test(u.pathname), respond: () => jsonResponse(404, { message: 'Not Found' }) },
    ])
    const value = await services.tools.run('pr_create', { title: 'x' })
    expect(value).toMatchObject({ status: 'error', code: 'github-api' })
    expect((value as { message: string }).message).toContain('404')
  })
})

describe('gh_review tool', () => {
  const DIFF = [
    'diff --git a/src/app.ts b/src/app.ts',
    '--- a/src/app.ts',
    '+++ b/src/app.ts',
    '@@ -1,2 +1,3 @@',
    ' x',
    '+// TODO: fix later',
  ].join('\n')

  const REVIEW_ROUTES = [
    { match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) !== 'application/vnd.github.diff', respond: () => jsonResponse(200, PULL_PAYLOAD, { 'x-ratelimit-remaining': '9' }) },
    { match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) === 'application/vnd.github.diff', respond: () => new Response(DIFF, { status: 200, headers: { 'Content-Type': 'text/plain' } }) },
    {
      match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && u.searchParams.get('per_page') === '20',
      respond: () => jsonResponse(200, [{ id: 1, body: 'looks good', path: 'src/a.ts', line: 4, user: { login: 'bob' } }]),
    },
    { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/commits/abc123/check-runs', respond: () => jsonResponse(200, { check_runs: [{ name: 'CI', status: 'completed', conclusion: 'success' }] }) },
  ]

  it('returns a structured summary with metadata, comments, CI, findings, and diff', async () => {
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: stubFetch([
        { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7/comments' && u.searchParams.get('per_page') === '20', respond: () => jsonResponse(200, [{ id: 1, body: 'looks good', path: 'src/a.ts', line: 4, user: { login: 'bob' } }]) },
        { match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) !== 'application/vnd.github.diff', respond: () => jsonResponse(200, PULL_PAYLOAD, { 'x-ratelimit-remaining': '9' }) },
        { match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) === 'application/vnd.github.diff', respond: () => new Response(DIFF, { status: 200, headers: { 'Content-Type': 'text/plain' } }) },
        { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/commits/abc123/check-runs', respond: () => jsonResponse(200, { check_runs: [{ name: 'CI', status: 'completed', conclusion: 'success' }] }) },
      ]),
    })
    const value = await services.tools.run('gh_review', { pr: 'o/r#7' }) as Record<string, unknown>
    expect(value.repo).toBe('o/r')
    expect(value.number).toBe(7)
    expect(value.author).toBe('alice')
    expect(value.rateLimit).toEqual({ remaining: 9, resetAt: null })
    expect((value.ci as { summary: string }).summary).toContain('1 check')
    expect(value.comments).toHaveLength(1)
    expect(value.findings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'todo-marker' })]))
    const diff = value.diff as { truncated: boolean; files: Array<{ path: string }> }
    expect(diff.truncated).toBe(false)
    expect(diff.files).toContainEqual({ path: 'src/app.ts', added: 1, removed: 0 })
  })

  it('parses PR references: number, #number, owner/repo#number, URL', async () => {
    const services = await loaded(REVIEW_ROUTES)
    for (const pr of ['7', '#7', 'o/r#7', 'https://github.com/o/r/pull/7']) {
      const value = await services.tools.run('gh_review', { pr }) as { number: number }
      expect(value.number).toBe(7)
    }
  })

  it('rejects a malformed PR reference structurally', async () => {
    const services = await loaded(REVIEW_ROUTES)
    const value = await services.tools.run('gh_review', { pr: 'nonsense' })
    expect(value).toMatchObject({ status: 'error', code: 'invalid-pr' })
  })
})

describe('gh_issue tool', () => {
  const ISSUE_ROUTES = [
    { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/issues', respond: () => jsonResponse(200, [{ number: 3, title: 'bug', state: 'open', html_url: 'https://github.com/o/r/issues/3', comments: 1, created_at: '2026-01-01T00:00:00Z', body: 'desc', user: { login: 'carol' } }]) },
    { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/issues/3', respond: () => jsonResponse(200, { number: 3, title: 'bug', state: 'open', html_url: 'https://github.com/o/r/issues/3', user: { login: 'carol' } }) },
    { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/issues/3/comments', respond: () => jsonResponse(200, [{ number: 1, title: 'c', state: 'open', html_url: 'x', user: { login: 'carol' } }]) },
  ]

  it('lists issues with normalized items', async () => {
    const services = await loaded(ISSUE_ROUTES)
    const value = await services.tools.run('gh_issue', { action: 'list', state: 'open' }) as { items: unknown[] }
    expect(value.items).toHaveLength(1)
    expect(value.items[0]).toMatchObject({ number: 3, title: 'bug', body: 'desc' })
  })

  it('requires issueNumber for get and comments', async () => {
    const services = await loaded(ISSUE_ROUTES)
    for (const action of ['get', 'comments']) {
      const value = await services.tools.run('gh_issue', { action })
      expect(value).toMatchObject({ status: 'error', code: 'invalid-args' })
    }
  })

  it('gets one issue and its comments', async () => {
    const services = await loaded(ISSUE_ROUTES)
    const get = await services.tools.run('gh_issue', { action: 'get', issueNumber: 3 })
    expect(get).toMatchObject({ total: 1, action: 'get' })
    const comments = await services.tools.run('gh_issue', { action: 'comments', issueNumber: 3 })
    expect(comments).toMatchObject({ action: 'comments', total: 1 })
  })
})

describe('review_post tool', () => {
  it('rejects an unknown job id structurally', async () => {
    const services = await loaded()
    const value = await services.tools.run('review_post', { jobId: 'github-review-99' })
    expect(value).toMatchObject({ status: 'error', code: 'unknown-job' })
  })

  it('posts the drafted comment for a completed job', async () => {
    const DIFF = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1,2 @@\n x\n+// TODO: later\n'
    const services = await loaded([
      { match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) === 'application/vnd.github.diff', respond: () => new Response(DIFF, { status: 200, headers: { 'Content-Type': 'text/plain' } }) },
      { match: (m: string, u: URL) => m === 'POST' && u.pathname === '/repos/o/r/issues/7/comments', respond: () => jsonResponse(201, { id: 42, html_url: 'https://github.com/o/r/pull/7#issuecomment-42' }) },
    ])
    const agent = new MockAgent()
    await services.commands.run('review', 'o/r#7', agent)
    const jobId = [...services.jobs.records.keys()][0] as string
    const done = await services.jobs.hooks(jobId).done
    expect(done.status).toBe('completed')
    const value = await services.tools.run('review_post', { jobId })
    expect(value).toMatchObject({ status: 'posted', url: 'https://github.com/o/r/pull/7#issuecomment-42', commentId: 42, findings: 1 })
  })
})

describe('issue_open tool', () => {
  it('creates an issue and returns the canonical value', async () => {
    const services = await loaded([{
      match: (m: string, u: URL) => m === 'POST' && u.pathname === '/repos/o/r/issues',
      respond: () => jsonResponse(201, { id: 1, number: 9, title: 'report', html_url: 'https://github.com/o/r/issues/9' }),
    }])
    const value = await services.tools.run('issue_open', { title: 'report', body: 'body', labels: ['bug'] })
    expect(value).toMatchObject({ status: 'created', number: 9, url: 'https://github.com/o/r/issues/9' })
  })

  it('degrades gracefully without a token', async () => {
    const services = await loaded()
    services.credentials.values.clear()
    const value = await services.tools.run('issue_open', { title: 'x' })
    expect(value).toMatchObject({ status: 'error', code: 'no-token' })
  })
})

describe('signal handling', () => {
  it('propagates a pre-aborted signal as a failure instead of hanging', async () => {
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: ((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        const sig = init?.signal
        if (sig?.aborted === true) {
          reject(sig.reason instanceof Error ? sig.reason : new Error('aborted'))
          return
        }
        sig?.addEventListener('abort', () => reject(sig.reason instanceof Error ? sig.reason : new Error('aborted')), { once: true })
      })) as typeof fetch,
    })
    const controller = new AbortController()
    controller.abort(new Error('cancelled'))
    const value = await services.tools.run('pr_create', { title: 'x', base: 'main', head: 'h' }, undefined, controller.signal)
      .catch(error => error)
    expect(value).not.toMatchObject({ status: 'created' })
  })
})
