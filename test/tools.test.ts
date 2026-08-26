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
  it('registers all fourteen tools', async () => {
    const services = await loaded()
    for (const name of ['pr_create', 'pr_merge', 'pr_update', 'gh_review', 'review_post', 'gh_issue', 'issue_open', 'issue_comment', 'issue_close', 'gh_search', 'gh_repo', 'gh_file', 'gh_repo_search', 'gh_checks']) {
      expect(services.tools.get(name).name).toBe(name)
    }
  })

  it('marks reads concurrency-safe and writes not', async () => {
    const services = await loaded()
    expect(services.tools.get('gh_review').isConcurrencySafe?.({ pr: '7' })).toBe(true)
    expect(services.tools.get('gh_issue').isConcurrencySafe?.({ action: 'list' })).toBe(true)
    expect(services.tools.get('gh_search').isConcurrencySafe?.({ q: 'x' })).toBe(true)
    expect(services.tools.get('gh_repo').isConcurrencySafe?.({})).toBe(true)
    expect(services.tools.get('gh_file').isConcurrencySafe?.({ path: 'a.txt' })).toBe(true)
    expect(services.tools.get('pr_create').isConcurrencySafe?.({ title: 'x' })).toBe(false)
    expect(services.tools.get('pr_merge').isConcurrencySafe?.({ pr: '7' })).toBe(false)
    expect(services.tools.get('pr_update').isConcurrencySafe?.({ pr: '7', title: 'x' })).toBe(false)
    expect(services.tools.get('review_post').isConcurrencySafe?.({ jobId: 'x' })).toBe(false)
    expect(services.tools.get('issue_open').isConcurrencySafe?.({ title: 'x' })).toBe(false)
    expect(services.tools.get('issue_comment').isConcurrencySafe?.({ issueNumber: 1, body: 'x' })).toBe(false)
    expect(services.tools.get('issue_close').isConcurrencySafe?.({ issueNumber: 1 })).toBe(false)
  })
})

describe('pr_create tool', () => {
  it('creates a PR and returns the canonical value with rate-limit facts', async () => {
    const services = await loaded()
    const value = await services.tools.run('pr_create', { title: 'feat: shiny', body: 'desc' })
    expect(value).toMatchObject({ status: 'created', url: 'https://github.com/o/r/pull/7', number: 7, base: 'main', head: 'feat/shiny' })
    expect((value as { rateLimit: unknown }).rateLimit).toBeDefined()
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

  it('refuses detached HEAD instead of sending "HEAD" as the branch', async () => {
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async (args: string[]) => {
        if (args.join(' ').includes('rev-parse')) return { stdout: 'HEAD\n' }
        throw new Error('unused')
      },
      fetchImpl: stubFetch([{ match: () => true, respond: () => jsonResponse(404, { message: 'unexpected call' }) }]),
    })
    const value = await services.tools.run('pr_create', { title: 'x' })
    expect(value).toMatchObject({ status: 'error', code: 'no-head' })
    expect((value as { message: string }).message).toContain('detached HEAD')
    expect((value as { guidance: string }).guidance).toContain('Check out a branch')
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

  it('surfaces GitHub API failures as structured errors with rate-limit facts', async () => {
    const services = await loaded([
      { match: (m: string, u: URL) => m === 'GET' && /\/repos\/[^/]+\/[^/]+$/.test(u.pathname), respond: () => jsonResponse(404, { message: 'Not Found' }, { 'x-ratelimit-remaining': '3' }) },
    ])
    const value = await services.tools.run('pr_create', { title: 'x' })
    expect(value).toMatchObject({ status: 'error', code: 'github-api' })
    expect((value as { message: string }).message).toContain('404')
    expect((value as { rateLimit: { remaining: number } }).rateLimit.remaining).toBe(3)
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
      match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7/comments' && u.searchParams.get('per_page') === '20',
      respond: () => jsonResponse(200, [{ id: 1, body: 'looks good', path: 'src/a.ts', line: 4, user: { login: 'bob' } }]),
    },
    { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/commits/abc123/check-runs', respond: () => jsonResponse(200, { check_runs: [{ name: 'CI', status: 'completed', conclusion: 'success' }] }) },
  ]

  it('returns a structured summary with metadata, comments, CI, findings, and the full capped diff', async () => {
    const services = await loaded(REVIEW_ROUTES)
    const value = await services.tools.run('gh_review', { pr: 'o/r#7' }) as Record<string, unknown>
    expect(value.repo).toBe('o/r')
    expect(value.number).toBe(7)
    expect(value.author).toBe('alice')
    expect(value.rateLimit).toEqual({ remaining: 9, resetAt: null })
    expect((value.ci as { summary: string }).summary).toContain('1 check')
    expect((value.comments as { items: unknown[] }).items).toHaveLength(1)
    expect(value.findings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'todo-marker' })]))
    const diff = value.diff as { truncated: boolean; text: string; excerpt: string; files: Array<{ path: string }> }
    expect(diff.truncated).toBe(false)
    expect(diff.text).toContain('+// TODO: fix later')
    expect(diff.excerpt).toBe(diff.text)
    expect(diff.files).toContainEqual({ path: 'src/app.ts', added: 1, removed: 0 })
  })

  it('caps the diff text and bounds the excerpt by renderExcerptChars', async () => {
    const diffText = `diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1,2 @@\n x\n+${'a'.repeat(500)}`
    const services = await loaded([
      { match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) !== 'application/vnd.github.diff', respond: () => jsonResponse(200, PULL_PAYLOAD) },
      { match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) === 'application/vnd.github.diff', respond: () => new Response(diffText, { status: 200, headers: { 'Content-Type': 'text/plain' } }) },
    ], { renderExcerptChars: 40 })
    const value = await services.tools.run('gh_review', { pr: '7', fields: ['diff'], maxDiffChars: 100 }) as Record<string, unknown>
    const diff = value.diff as { truncated: boolean; text: string; excerpt: string }
    expect(diff.truncated).toBe(true)
    expect(diff.text.length).toBe(100)
    expect(diff.excerpt.length).toBeLessThanOrEqual(40)
  })

  it('reports per-section fetch failures instead of swallowing them', async () => {
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: stubFetch([
        { match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) !== 'application/vnd.github.diff', respond: () => jsonResponse(200, PULL_PAYLOAD) },
        { match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) === 'application/vnd.github.diff', respond: () => jsonResponse(500, { message: 'boom' }) },
        { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7/comments', respond: () => jsonResponse(401, { message: 'denied' }) },
        { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/commits/abc123/check-runs', respond: () => jsonResponse(403, { message: 'no checks:read' }) },
      ]),
    })
    const value = await services.tools.run('gh_review', { pr: '7' }) as Record<string, unknown>
    const diff = value.diff as { error: string; text: string; files: unknown[] }
    const comments = value.comments as { error: string; items: unknown[] }
    const ci = value.ci as { error: string; summary: string }
    expect(diff.error).toBe('github-api-500')
    expect(diff.text).toBe('')
    expect(diff.files).toEqual([])
    expect(comments.error).toBe('github-api-401')
    expect(ci.error).toBe('github-api-403')
    expect(ci.summary).toBe('unknown')
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
    { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/issues', respond: () => jsonResponse(200, [
      { number: 3, title: 'bug', state: 'open', html_url: 'https://github.com/o/r/issues/3', comments: 1, created_at: '2026-01-01T00:00:00Z', body: 'desc', user: { login: 'carol' } },
      { number: 4, title: 'fix pr', state: 'open', html_url: 'https://github.com/o/r/pull/4', comments: 0, created_at: '2026-01-02T00:00:00Z', body: 'pr body', user: { login: 'dave' }, pull_request: { url: 'https://api.github.com/o/r/pulls/4' } },
    ]) },
    { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/issues/3', respond: () => jsonResponse(200, { number: 3, title: 'bug', state: 'open', html_url: 'https://github.com/o/r/issues/3', user: { login: 'carol' } }) },
    { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/issues/3/comments', respond: () => jsonResponse(200, [{ id: 9, body: 'first line\nsecond line', html_url: 'https://github.com/o/r/issues/3#issuecomment-9', created_at: '2026-01-03T00:00:00Z', user: { login: 'eve' } }]) },
  ]

  it('lists issues and marks pull requests with kind', async () => {
    const services = await loaded(ISSUE_ROUTES)
    const value = await services.tools.run('gh_issue', { action: 'list', state: 'open' }) as { items: Array<Record<string, unknown>> }
    expect(value.items).toHaveLength(2)
    expect(value.items[0]).toMatchObject({ number: 3, title: 'bug', body: 'desc', kind: 'issue' })
    expect(value.items[1]).toMatchObject({ number: 4, kind: 'pr' })
  })

  it('requires issueNumber for get and comments', async () => {
    const services = await loaded(ISSUE_ROUTES)
    for (const action of ['get', 'comments']) {
      const value = await services.tools.run('gh_issue', { action })
      expect(value).toMatchObject({ status: 'error', code: 'invalid-args' })
    }
  })

  it('gets one issue and maps comment payloads to items', async () => {
    const services = await loaded(ISSUE_ROUTES)
    const get = await services.tools.run('gh_issue', { action: 'get', issueNumber: 3 })
    expect(get).toMatchObject({ total: 1, action: 'get' })
    const comments = await services.tools.run('gh_issue', { action: 'comments', issueNumber: 3 }) as { total: number; items: Array<Record<string, unknown>> }
    expect(comments).toMatchObject({ action: 'comments', total: 1 })
    expect(comments.items[0]).toMatchObject({ number: 9, kind: 'comment', title: 'first line' })
  })
})

describe('review_post tool', () => {
  it('rejects an unknown job id structurally', async () => {
    const services = await loaded()
    const value = await services.tools.run('review_post', { jobId: 'github-review-99' })
    expect(value).toMatchObject({ status: 'error', code: 'unknown-job' })
  })

  it('posts the drafted comment for a completed job and honors a body override', async () => {
    const DIFF = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1,2 @@\n x\n+// TODO: later\n'
    let postedBody: string | undefined
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
        const method = init?.method ?? 'GET'
        if (url.pathname === '/repos/o/r/pulls/7' && method === 'GET' && accept(init) !== 'application/vnd.github.diff') return jsonResponse(200, PULL_PAYLOAD)
        if (url.pathname === '/repos/o/r/pulls/7' && method === 'GET') return new Response(DIFF, { status: 200, headers: { 'Content-Type': 'text/plain' } })
        if (url.pathname === '/repos/o/r/issues/7/comments' && method === 'POST') {
          postedBody = String(init?.body ?? '')
          return jsonResponse(201, { id: 42, html_url: 'https://github.com/o/r/pull/7#issuecomment-42' })
        }
        return jsonResponse(404, { message: 'nope' })
      }) as typeof fetch,
    })
    const agent = new MockAgent()
    await services.commands.run('review', 'o/r#7 --no-ci --no-comments', agent)
    const jobId = [...services.jobs.records.keys()][0] as string
    const done = await services.jobs.hooks(jobId).done
    expect(done.status).toBe('completed')
    const value = await services.tools.run('review_post', { jobId, body: 'custom review text' })
    expect(value).toMatchObject({ status: 'posted', mode: 'summary', url: 'https://github.com/o/r/pull/7#issuecomment-42', commentId: 42, findings: 1 })
    expect(JSON.parse(postedBody as string)).toEqual({ body: 'custom review text' })
  })

  it('posts an inline review against the head commit', async () => {
    const DIFF = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1,2 @@\n x\n+// TODO: later\n'
    let postedBody: string | undefined
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
        const method = init?.method ?? 'GET'
        if (url.pathname === '/repos/o/r/pulls/7' && method === 'GET' && accept(init) !== 'application/vnd.github.diff') return jsonResponse(200, PULL_PAYLOAD)
        if (url.pathname === '/repos/o/r/pulls/7' && method === 'GET') return new Response(DIFF, { status: 200, headers: { 'Content-Type': 'text/plain' } })
        if (url.pathname === '/repos/o/r/pulls/7/reviews' && method === 'POST') {
          postedBody = String(init?.body ?? '')
          return jsonResponse(200, { id: 77, html_url: 'https://github.com/o/r/pull/7#pullrequestreview-77' })
        }
        return jsonResponse(404, { message: 'nope' })
      }) as typeof fetch,
    })
    const agent = new MockAgent()
    await services.commands.run('review', 'o/r#7 --no-ci --no-comments', agent)
    const jobId = [...services.jobs.records.keys()][0] as string
    await services.jobs.hooks(jobId).done
    const value = await services.tools.run('review_post', { jobId, mode: 'inline' })
    expect(value).toMatchObject({ status: 'posted', mode: 'inline', reviewId: 77, findings: 1 })
    const body = JSON.parse(postedBody as string) as { event: string; comments: Array<{ path: string; line: number; body: string }> }
    expect(body.event).toBe('COMMENT')
    expect(body.comments).toHaveLength(1)
    expect(body.comments[0]).toMatchObject({ path: 'a.ts', line: 2 })
    expect(body.comments[0]?.body).toContain('todo-marker')
  })
})

describe('issue_open tool', () => {
  it('creates an issue and returns the canonical value with rate-limit facts', async () => {
    const services = await loaded([{
      match: (m: string, u: URL) => m === 'POST' && u.pathname === '/repos/o/r/issues',
      respond: () => jsonResponse(201, { id: 1, number: 9, title: 'report', html_url: 'https://github.com/o/r/issues/9' }, { 'x-ratelimit-remaining': '11' }),
    }])
    const value = await services.tools.run('issue_open', { title: 'report', body: 'body', labels: ['bug'] })
    expect(value).toMatchObject({ status: 'created', number: 9, url: 'https://github.com/o/r/issues/9' })
    expect((value as { rateLimit: { remaining: number } }).rateLimit.remaining).toBe(11)
  })

  it('degrades gracefully without a token', async () => {
    const services = await loaded()
    services.credentials.values.clear()
    const value = await services.tools.run('issue_open', { title: 'x' })
    expect(value).toMatchObject({ status: 'error', code: 'no-token' })
  })
})

describe('issue_comment tool', () => {
  it('comments on an issue and returns the canonical value', async () => {
    let postedBody: string | undefined
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
        if (url.pathname === '/repos/o/r/issues/9/comments' && init?.method === 'POST') {
          postedBody = String(init.body ?? '')
          return jsonResponse(201, { id: 12, html_url: 'https://github.com/o/r/issues/9#issuecomment-12' })
        }
        return jsonResponse(404, { message: 'nope' })
      }) as typeof fetch,
    })
    const value = await services.tools.run('issue_comment', { issueNumber: 9, body: '  agree with this fix  ' })
    expect(value).toMatchObject({ status: 'commented', commentId: 12, issueNumber: 9, url: 'https://github.com/o/r/issues/9#issuecomment-12' })
    expect(JSON.parse(postedBody as string)).toEqual({ body: 'agree with this fix' })
  })

  it('rejects an empty body structurally', async () => {
    const services = await loaded()
    const value = await services.tools.run('issue_comment', { issueNumber: 9, body: '   ' })
    expect(value).toMatchObject({ status: 'error', code: 'invalid-args' })
  })
})

describe('issue_close tool', () => {
  it('closes an issue and returns the canonical value', async () => {
    let patchBody: string | undefined
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
        if (url.pathname === '/repos/o/r/issues/9' && init?.method === 'PATCH') {
          patchBody = String(init.body ?? '')
          return jsonResponse(200, { number: 9, title: 'old bug', html_url: 'https://github.com/o/r/issues/9' })
        }
        return jsonResponse(404, { message: 'nope' })
      }) as typeof fetch,
    })
    const value = await services.tools.run('issue_close', { issueNumber: 9, stateReason: 'not_planned' })
    expect(value).toMatchObject({ status: 'closed', number: 9, url: 'https://github.com/o/r/issues/9' })
    expect(JSON.parse(patchBody as string)).toEqual({ state: 'closed', state_reason: 'not_planned' })
  })
})

describe('gh_search tool', () => {
  it('searches issues and pull requests with the search quota surfaced', async () => {
    const services = await loaded([
      {
        match: (m: string, u: URL) => m === 'GET' && u.pathname === '/search/issues' && u.searchParams.get('q') === 'repo:o/r bug' && u.searchParams.get('per_page') === '5',
        respond: () => jsonResponse(200, {
          total_count: 2,
          items: [
            { number: 5, title: 'bug found', state: 'open', html_url: 'https://github.com/o/r/issues/5', comments: 2, created_at: '2026-01-01T00:00:00Z', user: { login: 'frank' } },
            { number: 6, title: 'fix pr', state: 'open', html_url: 'https://github.com/o/r/pull/6', comments: 0, created_at: '2026-01-02T00:00:00Z', user: { login: 'gina' }, pull_request: {} },
          ],
        }, { 'x-ratelimit-remaining': '17' }),
      },
    ])
    const value = await services.tools.run('gh_search', { q: 'repo:o/r bug', perPage: 5 }) as { query: string; total: number; items: Array<Record<string, unknown>>; rateLimit: { remaining: number } }
    expect(value.query).toBe('repo:o/r bug')
    expect(value.total).toBe(2)
    expect(value.rateLimit.remaining).toBe(17)
    expect(value.items[0]).toMatchObject({ number: 5, kind: 'issue', repo: 'o/r' })
    expect(value.items[1]).toMatchObject({ number: 6, kind: 'pr', repo: 'o/r' })
  })

  it('rejects an empty query structurally', async () => {
    const services = await loaded()
    const value = await services.tools.run('gh_search', { q: '   ' })
    expect(value).toMatchObject({ status: 'error', code: 'invalid-args' })
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

describe('pr_merge tool', () => {
  const MERGE_ROUTES = [
    { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7', respond: () => jsonResponse(200, PULL_PAYLOAD) },
    {
      match: (m: string, u: URL) => m === 'PUT' && u.pathname === '/repos/o/r/pulls/7/merge',
      respond: () => jsonResponse(200, { sha: 'merged-sha', merged: true, message: 'Pull Request successfully merged' }, { 'x-ratelimit-remaining': '8' }),
    },
  ]

  it('merges with the head SHA and returns the canonical value', async () => {
    let mergeBody: string | undefined
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
        if (url.pathname === '/repos/o/r/pulls/7' && init?.method === 'GET') return jsonResponse(200, PULL_PAYLOAD)
        if (url.pathname === '/repos/o/r/pulls/7/merge' && init?.method === 'PUT') {
          mergeBody = String(init.body ?? '')
          return jsonResponse(200, { sha: 'merged-sha', merged: true, message: 'Pull Request successfully merged' }, { 'x-ratelimit-remaining': '8' })
        }
        return jsonResponse(404, { message: 'nope' })
      }) as typeof fetch,
    })
    const value = await services.tools.run('pr_merge', { pr: 'o/r#7', mergeMethod: 'squash', commitTitle: 'feat: shiny (#7)' })
    expect(value).toMatchObject({
      status: 'merged', merged: true, sha: 'merged-sha', url: 'https://github.com/o/r/pull/7', branchDeleted: false,
    })
    expect((value as { rateLimit: { remaining: number } }).rateLimit.remaining).toBe(8)
    const body = JSON.parse(mergeBody as string) as Record<string, unknown>
    expect(body.merge_method).toBe('squash')
    expect(body.sha).toBe('abc123')
    expect(body.commit_title).toBe('feat: shiny (#7)')
  })

  it('deletes the head branch after merging when requested', async () => {
    const calls: string[] = []
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
        calls.push(`${init?.method} ${url.pathname}`)
        if (url.pathname === '/repos/o/r/pulls/7' && init?.method === 'GET') return jsonResponse(200, PULL_PAYLOAD)
        if (url.pathname === '/repos/o/r/pulls/7/merge') return jsonResponse(200, { sha: 's', merged: true, message: 'merged' })
        if (url.pathname === '/repos/o/r/git/refs/heads%2Ffeat%2Fshiny' && init?.method === 'DELETE') return new Response(null, { status: 204 })
        return jsonResponse(404, { message: 'nope' })
      }) as typeof fetch,
    })
    const value = await services.tools.run('pr_merge', { pr: '7', deleteBranch: true })
    expect(value).toMatchObject({ status: 'merged', branchDeleted: true })
    expect(calls).toContain('DELETE /repos/o/r/git/refs/heads%2Ffeat%2Fshiny')
  })

  it('notes a failed branch deletion without failing the merge', async () => {
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
        if (url.pathname === '/repos/o/r/pulls/7' && init?.method === 'GET') return jsonResponse(200, PULL_PAYLOAD)
        if (url.pathname === '/repos/o/r/pulls/7/merge') return jsonResponse(200, { sha: 's', merged: true, message: 'merged' })
        if (init?.method === 'DELETE') return jsonResponse(422, { message: 'Reference does not exist' })
        return jsonResponse(404, { message: 'nope' })
      }) as typeof fetch,
    })
    const value = await services.tools.run('pr_merge', { pr: '7', deleteBranch: true })
    expect(value).toMatchObject({ status: 'merged', branchDeleted: false })
    expect((value as { branchDeleteNote: string }).branchDeleteNote).toContain('422')
  })

  it('surfaces a not-mergeable PR as a structured error', async () => {
    const services = await loaded([
      { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7', respond: () => jsonResponse(200, PULL_PAYLOAD) },
      { match: (m: string, u: URL) => m === 'PUT' && u.pathname === '/repos/o/r/pulls/7/merge', respond: () => jsonResponse(405, { message: 'Pull Request is not mergeable' }) },
    ])
    const value = await services.tools.run('pr_merge', { pr: 'o/r#7' })
    expect(value).toMatchObject({ status: 'error', code: 'github-api' })
    expect((value as { message: string }).message).toContain('405')
  })

  it('rejects an invalid PR reference structurally', async () => {
    const services = await loaded(MERGE_ROUTES)
    const value = await services.tools.run('pr_merge', { pr: 'not-a-ref' })
    expect(value).toMatchObject({ status: 'error', code: 'invalid-pr' })
  })
})

describe('pr_update tool', () => {
  const UPDATED_PAYLOAD = { ...PULL_PAYLOAD, title: 'new title', state: 'closed' }

  it('patches only the provided fields and returns the updated PR', async () => {
    let patchBody: string | undefined
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
        if (url.pathname === '/repos/o/r/pulls/7' && init?.method === 'PATCH') {
          patchBody = String(init.body ?? '')
          return jsonResponse(200, UPDATED_PAYLOAD, { 'x-ratelimit-remaining': '7' })
        }
        return jsonResponse(404, { message: 'nope' })
      }) as typeof fetch,
    })
    const value = await services.tools.run('pr_update', { pr: 'o/r#7', title: 'new title', state: 'closed' })
    expect(value).toMatchObject({ status: 'updated', number: 7, title: 'new title', state: 'closed', base: 'main' })
    const body = JSON.parse(patchBody as string) as Record<string, unknown>
    expect(body).toEqual({ title: 'new title', state: 'closed' })
  })

  it('requires at least one editable field', async () => {
    const services = await loaded()
    const value = await services.tools.run('pr_update', { pr: 'o/r#7' })
    expect(value).toMatchObject({ status: 'error', code: 'invalid-args' })
  })

  it('rejects an empty title', async () => {
    const services = await loaded()
    const value = await services.tools.run('pr_update', { pr: 'o/r#7', title: '   ' })
    expect(value).toMatchObject({ status: 'error', code: 'invalid-args' })
  })
})

describe('gh_repo tool', () => {
  const REPO_PAYLOAD = {
    description: 'the main repo',
    default_branch: 'main',
    visibility: 'public',
    stargazers_count: 42,
    forks_count: 7,
    open_issues_count: 3,
    language: 'TypeScript',
    license: { spdx_id: 'Apache-2.0' },
    topics: ['dsh', 'plugin'],
    html_url: 'https://github.com/o/r',
    updated_at: '2026-08-14T00:00:00Z',
  }

  it('maps repository metadata into the canonical value', async () => {
    const services = await loaded([
      { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r', respond: () => jsonResponse(200, REPO_PAYLOAD, { 'x-ratelimit-remaining': '6' }) },
    ])
    const value = await services.tools.run('gh_repo', {})
    expect(value).toMatchObject({
      repo: 'o/r', description: 'the main repo', defaultBranch: 'main', visibility: 'public',
      stars: 42, forks: 7, openIssues: 3, language: 'TypeScript', license: 'Apache-2.0',
      topics: ['dsh', 'plugin'], url: 'https://github.com/o/r',
    })
    expect((value as { rateLimit: { remaining: number } }).rateLimit.remaining).toBe(6)
  })

  it('surfaces a missing repository as a structured error', async () => {
    const services = await loaded([
      { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r', respond: () => jsonResponse(404, { message: 'Not Found' }) },
    ])
    const value = await services.tools.run('gh_repo', {})
    expect(value).toMatchObject({ status: 'error', code: 'github-api' })
  })
})

describe('gh_file tool', () => {
  const FILE_PAYLOAD = {
    name: 'README.md',
    path: 'README.md',
    sha: 'file-sha-123',
    size: 12,
    content: Buffer.from('hello world\n').toString('base64'),
    encoding: 'base64',
    html_url: 'https://github.com/o/r/blob/main/README.md',
  }

  it('decodes base64 content and caps it at the configured limit', async () => {
    let seenPath: string | undefined
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r', maxFileChars: 5 },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
        seenPath = url.pathname
        if (url.pathname === '/repos/o/r/contents/README.md' && init?.method === 'GET') return jsonResponse(200, FILE_PAYLOAD, { 'x-ratelimit-remaining': '5' })
        return jsonResponse(404, { message: 'nope' })
      }) as typeof fetch,
    })
    const value = await services.tools.run('gh_file', { path: 'README.md' })
    expect(value).toMatchObject({
      repo: 'o/r', path: 'README.md', ref: 'default', size: 12, truncated: true, content: 'hello', sha: 'file-sha-123',
    })
    expect((value as { rateLimit: { remaining: number } }).rateLimit.remaining).toBe(5)
    expect(seenPath).toBe('/repos/o/r/contents/README.md')
  })

  it('passes the ref query and encodes path segments', async () => {
    const seen: Array<{ path: string; ref: string | null }> = []
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
        seen.push({ path: url.pathname, ref: url.searchParams.get('ref') })
        if (init?.method === 'GET') return jsonResponse(200, { ...FILE_PAYLOAD, path: 'src/a b.ts' })
        return jsonResponse(404, { message: 'nope' })
      }) as typeof fetch,
    })
    const value = await services.tools.run('gh_file', { path: 'src/a b.ts', ref: 'v1.0' })
    expect(value).toMatchObject({ path: 'src/a b.ts', ref: 'v1.0' })
    expect(seen[0]?.path).toBe('/repos/o/r/contents/src/a%20b.ts')
    expect(seen[0]?.ref).toBe('v1.0')
  })

  it('reports a directory path as a structured error', async () => {
    const services = await loaded([
      { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/contents/src', respond: () => jsonResponse(200, [{ name: 'a.ts' }]) },
    ])
    const value = await services.tools.run('gh_file', { path: 'src' })
    expect(value).toMatchObject({ status: 'error', code: 'is-directory' })
    expect((value as { guidance: string }).guidance).toContain('directory')
  })

  it('rejects an empty or absolute path structurally', async () => {
    const services = await loaded()
    expect(await services.tools.run('gh_file', { path: '   ' })).toMatchObject({ status: 'error', code: 'invalid-args' })
    expect(await services.tools.run('gh_file', { path: '/etc/passwd' })).toMatchObject({ status: 'error', code: 'invalid-args' })
  })
})
