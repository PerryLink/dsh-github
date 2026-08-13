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

const DIFF = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1,2 @@\n x\n+// TODO: later\n'

const FULL_ROUTES = [
  { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r', respond: () => jsonResponse(200, { default_branch: 'main' }) },
  { match: (m: string, u: URL) => m === 'POST' && u.pathname === '/repos/o/r/pulls', respond: () => jsonResponse(201, PULL_PAYLOAD) },
  { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && u.searchParams.size === 0, respond: () => jsonResponse(200, PULL_PAYLOAD) },
  { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7', respond: () => new Response(DIFF, { status: 200, headers: { 'Content-Type': 'text/plain' } }) },
  { match: () => true, respond: () => jsonResponse(404, { message: 'not stubbed' }) },
]

describe('token non-leakage (S2)', () => {
  it('never emits the token in tool values, renders, cards, commands, notices, jobs, or approval reasons', async () => {
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async (args: string[]) => {
        if (args.join(' ').includes('rev-parse')) return { stdout: 'feat/shiny\n' }
        if (args.join(' ').includes('status')) return { stdout: '' }
        if (args.join(' ').includes('remote')) return { stdout: 'https://github.com/o/r.git\n' }
        return { stdout: '' }
      },
      fetchImpl: stubFetch(FULL_ROUTES),
    })

    const agent = new MockAgent()
    const strings: string[] = []
    const collect = (label: string, value: unknown) => strings.push(`${label}: ${JSON.stringify(value)}`)

    for (const [name, args] of [
      ['pr_create', { title: 'x' }],
      ['gh_review', { pr: 'o/r#7' }],
      ['gh_issue', { action: 'list' }],
      ['issue_open', { title: 'x' }],
    ] as Array<[string, Record<string, unknown>]>) {
      const value = await services.tools.run(name, args, agent).catch(error => ({ thrown: String(error) }))
      collect(name, value)
      const def = services.tools.get(name)
      collect(`${name} render`, def.output.render(args, value))
      collect(`${name} presentCall`, def.presentCall?.(args) ?? null)
      collect(`${name} presentResult`, def.presentResult?.(args, { content: [], isError: false, meta: value }) ?? null)
    }

    for (const [name, input] of [['pr', 'create t'], ['review', 'o/r#7'], ['issue', 'open t']] as Array<[string, string]>) {
      collect(`${name} result`, await services.commands.run(name, input, agent))
    }
    for (const item of [...agent.followed, ...agent.injected]) collect('model instruction', item.text)

    const jobId = [...services.jobs.records.keys()][0]
    if (jobId !== undefined) collect('job outcome', await services.jobs.hooks(jobId).done)

    const decision = await services.ctx.waterfall(
      'tools/pre-execute',
      {
        callId: 'c1',
        rootCallId: 'c1',
        name: 'pr_create',
        arguments: { title: 'gate probe' },
        agent: new MockAgent(),
        signal: new AbortController().signal,
        token: Symbol('t'),
      } as never,
      async () => ({ kind: 'allow' }) as never,
    )
    collect('approval reason', decision)

    for (const text of strings) {
      expect(text).not.toContain(TOKEN)
      expect(text.toLowerCase()).not.toContain(TOKEN.toLowerCase())
    }
  })

  it('does not leak the token even when every read fails', async () => {
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('no git') },
      fetchImpl: stubFetch([{ match: () => true, respond: () => jsonResponse(500, { message: 'boom' }) }]),
    })
    const agent = new MockAgent()
    const outputs: string[] = []
    for (const [name, args] of [
      ['pr_create', { title: 'x', base: 'main', head: 'h' }],
      ['gh_review', { pr: '7' }],
      ['gh_issue', { action: 'list' }],
      ['issue_open', { title: 'x' }],
      ['review_post', { jobId: 'nope' }],
    ] as Array<[string, Record<string, unknown>]>) {
      const value = await services.tools.run(name, args, agent).catch(error => ({ thrown: String(error) }))
      outputs.push(JSON.stringify(value))
      outputs.push(JSON.stringify(services.tools.get(name).output.render(args, value)))
    }
    outputs.push(JSON.stringify(await services.commands.run('pr', 'create t', agent)))
    outputs.push(...agent.followed.map(item => item.text), ...agent.injected.map(item => item.text))
    for (const text of outputs) expect(text).not.toContain(TOKEN)
  })

  it('keeps the token out of the posted comment body', async () => {
    let postedBody: string | undefined
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: stubFetch([
        {
          match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7',
          respond: () => new Response(DIFF, { status: 200, headers: { 'Content-Type': 'text/plain' } }),
        },
        {
          match: (m: string, u: URL) => m === 'POST' && u.pathname === '/repos/o/r/issues/7/comments',
          respond: () => jsonResponse(201, { id: 1, html_url: 'https://github.com/o/r/pull/7#issuecomment-1' }),
        },
      ]),
    })
    // Capture the posted body through a second, recording fetch.
    services.ctx.get('tools') // touch only; replacement below re-loads with recording fetch
    const capturing = makeServices()
    capturing.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(capturing, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
        if (url.pathname === '/repos/o/r/pulls/7' && (init?.method ?? 'GET') === 'GET') {
          return new Response(DIFF, { status: 200, headers: { 'Content-Type': 'text/plain' } })
        }
        if (url.pathname === '/repos/o/r/issues/7/comments') {
          postedBody = String(init?.body ?? '')
          return jsonResponse(201, { id: 1, html_url: 'https://github.com/o/r/pull/7#issuecomment-1' })
        }
        return jsonResponse(404, { message: 'nope' })
      }) as typeof fetch,
    })
    const agent = new MockAgent()
    await capturing.commands.run('review', 'o/r#7', agent)
    const jobId = [...capturing.jobs.records.keys()][0] as string
    await capturing.jobs.hooks(jobId).done
    await capturing.tools.run('review_post', { jobId }, agent)
    expect(postedBody).toBeDefined()
    expect(postedBody).not.toContain(TOKEN)
    expect(postedBody).toContain('todo-marker')
  })
})
