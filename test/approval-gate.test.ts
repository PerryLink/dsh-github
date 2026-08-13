import { describe, expect, it } from 'vitest'
import { loadPlugin, makeServices, MockAgent, stubFetch, jsonResponse, TOKEN } from './helpers.ts'

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

function execLike(name: string, args: unknown) {
  return {
    callId: 'call-1',
    rootCallId: 'call-1',
    name,
    arguments: args,
    agent: new MockAgent(),
    signal: new AbortController().signal,
    token: Symbol('token'),
  }
}

async function loaded(config: Record<string, unknown> = {}) {
  const services = makeServices()
  services.credentials.values.set('GITHUB_TOKEN', TOKEN)
  await loadPlugin(services, {
    config: { defaultOwnerRepo: 'o/r', ...config },
    runGit: async () => { throw new Error('unused') },
    fetchImpl: stubFetch([
      { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7', respond: () => jsonResponse(200, PULL_PAYLOAD) },
      { match: () => true, respond: () => jsonResponse(404, { message: 'not stubbed' }) },
    ]),
  })
  return services
}

async function decide(services: Awaited<ReturnType<typeof loaded>>, name: string, args: unknown) {
  return services.ctx.waterfall(
    'tools/pre-execute',
    execLike(name, args) as never,
    async () => ({ kind: 'allow' }) as never,
  )
}

describe('approval gate (tools/pre-execute)', () => {
  it('asks for approval on pr_create with a readable reason', async () => {
    const services = await loaded()
    const decision = await decide(services, 'pr_create', { title: 'my PR' })
    expect(decision).toMatchObject({ kind: 'ask' })
    expect((decision as { reason: string }).reason).toContain('create GitHub pull request "my PR"')
  })

  it('asks for approval on issue_open and review_post', async () => {
    const services = await loaded()
    expect(await decide(services, 'issue_open', { title: 'bug' })).toMatchObject({ kind: 'ask' })
    expect(await decide(services, 'review_post', { jobId: 'github-review-1' })).toMatchObject({ kind: 'ask' })
  })

  it('enriches the review_post reason with the drafted findings', async () => {
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: stubFetch([
        {
          match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7',
          respond: () => new Response(
            'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1,2 @@\n x\n+// TODO: later\n',
            { status: 200, headers: { 'Content-Type': 'text/plain' } },
          ),
        },
        { match: () => true, respond: () => jsonResponse(404, { message: 'not stubbed' }) },
      ]),
    })
    // A completed review job populates the plugin's record map.
    const agent = new MockAgent()
    await services.commands.run('review', 'o/r#7', agent)
    const jobId = [...services.jobs.records.keys()][0] as string
    await services.jobs.hooks(jobId).done
    const decision = await decide(services, 'review_post', { jobId })
    expect(decision).toMatchObject({ kind: 'ask' })
    expect((decision as { reason: string }).reason).toContain('1 finding(s)')
  })

  it('denies write actions missing from the allowedActions whitelist', async () => {
    const services = await loaded({ allowedActions: ['review.post'] })
    const decision = await decide(services, 'pr_create', { title: 'x' })
    expect(decision).toMatchObject({ kind: 'deny' })
    expect((decision as { reason: string }).reason).toContain('allowedActions')
  })

  it('delegates non-write tools via next()', async () => {
    const services = await loaded()
    const decision = await decide(services, 'bash', { command: 'ls' })
    expect(decision).toEqual({ kind: 'allow' })
  })
})
