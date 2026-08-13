import { describe, expect, it } from 'vitest'
import { loadPlugin, makeServices, MockAgent, stubFetch, jsonResponse } from './helpers.ts'

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

async function loaded(config: Record<string, unknown> = {}, git: Record<string, string> | 'error' = {}) {
  const services = makeServices()
  services.credentials.values.set('GITHUB_TOKEN', 'ghp_test')
  await loadPlugin(services, {
    config: { defaultOwnerRepo: 'o/r', ...config },
    runGit: async (args: string[]) => {
      if (git === 'error') throw new Error('not a git repository')
      const key = args.join(' ')
      if (key in git) return { stdout: git[key] as string }
      if (key.includes('rev-parse')) return { stdout: 'feat/shiny\n' }
      if (key.includes('status')) return { stdout: '' }
      if (key.includes('remote')) return { stdout: 'https://github.com/o/r.git\n' }
      if (key.includes('log')) return { stdout: 'aaa111 one\n' }
      throw new Error(`unexpected git args: ${key}`)
    },
    fetchImpl: stubFetch([
      { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7', respond: () => new Response(DIFF, { status: 200, headers: { 'Content-Type': 'text/plain' } }) },
      { match: () => true, respond: () => jsonResponse(404, { message: 'not stubbed' }) },
    ]),
  })
  return services
}

describe('/pr command', () => {
  it('prints usage without arguments', async () => {
    const services = await loaded()
    const result = await services.commands.run('pr', '', new MockAgent())
    expect(result.kind).toBe('success')
    expect(result.text).toContain('/pr create')
  })

  it('queues a pr_create instruction with git facts and the title', async () => {
    const services = await loaded()
    const agent = new MockAgent()
    const result = await services.commands.run('pr', 'create my shiny feature', agent)
    expect(result.kind).toBe('success')
    const text = agent.followed[0]?.text ?? ''
    expect(text).toContain('pr_create')
    expect(text).toContain('"my shiny feature"')
    expect(text).toContain('ownerRepo: o/r')
    expect(text).toContain('head: feat/shiny')
    expect(text).toContain('do NOT commit or push')
  })

  it('wakes an idle agent and injects into a busy one', async () => {
    const services = await loaded()
    const idle = new MockAgent()
    await services.commands.run('pr', 'create t', idle)
    expect(idle.followed).toHaveLength(1)
    expect(idle.injected).toHaveLength(0)
    const busy = new MockAgent()
    busy.status = 'running'
    await services.commands.run('pr', 'create t', busy)
    expect(busy.injected).toHaveLength(1)
    expect(busy.followed).toHaveLength(0)
  })

  it('mentions uncommitted changes and unpushed commits', async () => {
    const services = await loaded({}, {
      'status --porcelain=v1': 'M src/a.ts\n',
      'log --oneline -n 20 @{upstream}..HEAD': 'aaa111 one\nbbb222 two\n',
    })
    const agent = new MockAgent()
    await services.commands.run('pr', 'create t', agent)
    const text = agent.followed[0]?.text ?? ''
    expect(text).toContain('uncommitted changes: M src/a.ts')
    expect(text).toContain('aaa111 one')
  })

  it('instructs commit+push first when autoCommit is enabled', async () => {
    const services = await loaded({ autoCommit: true })
    const agent = new MockAgent()
    await services.commands.run('pr', 'create t', agent)
    expect(agent.followed[0]?.text).toContain('autoCommit is enabled')
  })

  it('fails with guidance outside a git checkout', async () => {
    const services = await loaded({}, 'error')
    const result = await services.commands.run('pr', 'create t', new MockAgent())
    expect(result.kind).toBe('error')
    expect(result.text).toContain('git checkout')
  })

  it('rejects unknown subcommands', async () => {
    const services = await loaded()
    const result = await services.commands.run('pr', 'merge', new MockAgent())
    expect(result.kind).toBe('error')
  })
})

describe('/review command', () => {
  it('starts a background review job and returns its id', async () => {
    const services = await loaded()
    const agent = new MockAgent()
    const result = await services.commands.run('review', 'o/r#7', agent)
    expect(result.kind).toBe('success')
    expect(result.text).toContain('github-review-1')
    expect(services.jobs.startCalls[0]).toMatchObject({ kind: 'github-review', owner: agent })
  })

  it('parses bare numbers via the configured repo', async () => {
    const services = await loaded()
    const result = await services.commands.run('review', '7', new MockAgent())
    expect(result.kind).toBe('success')
    expect(services.jobs.startCalls[0]?.label).toContain('PR #7')
  })

  it('rejects malformed PR references', async () => {
    const services = await loaded()
    const result = await services.commands.run('review', 'not-a-pr', new MockAgent())
    expect(result.kind).toBe('error')
    expect(result.text).toContain('not a PR reference')
  })

  it('stops a running job', async () => {
    const services = makeServices()
    services.credentials.values.set('GITHUB_TOKEN', 'ghp_test')
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r' },
      runGit: async () => { throw new Error('unused') },
      // The diff fetch hangs until the job is cancelled, keeping it running.
      fetchImpl: ((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        const sig = init?.signal
        if (sig?.aborted === true) {
          reject(sig.reason instanceof Error ? sig.reason : new Error('aborted'))
          return
        }
        sig?.addEventListener('abort', () => reject(sig.reason instanceof Error ? sig.reason : new Error('aborted')), { once: true })
      })) as typeof fetch,
    })
    const agent = new MockAgent()
    await services.commands.run('review', 'o/r#7', agent)
    const jobId = [...services.jobs.records.keys()][0] as string
    const result = await services.commands.run('review', `stop ${jobId}`, agent)
    expect(result.kind).toBe('success')
    expect(result.text).toContain('requested stop')
    const done = await services.jobs.hooks(jobId).done
    expect(done.status).toBe('killed')
  })

  it('posts only after completion', async () => {
    const services = await loaded()
    const agent = new MockAgent()
    await services.commands.run('review', 'o/r#7', agent)
    const jobId = [...services.jobs.records.keys()][0] as string
    const early = await services.commands.run('review', `post ${jobId}`, agent)
    expect(early.kind).toBe('error')
    await services.jobs.hooks(jobId).done
    const result = await services.commands.run('review', `post ${jobId}`, agent)
    expect(result.kind).toBe('success')
    expect(agent.followed[0]?.text).toContain('review_post')
    expect(agent.followed[0]?.text).toContain(jobId)
  })

  it('rejects posting an unknown job', async () => {
    const services = await loaded()
    const result = await services.commands.run('review', 'post github-review-99', new MockAgent())
    expect(result.kind).toBe('error')
  })
})

describe('/issue command', () => {
  it('queues an issue_open instruction with the title', async () => {
    const services = await loaded()
    const agent = new MockAgent()
    const result = await services.commands.run('issue', 'open crash on start', agent)
    expect(result.kind).toBe('success')
    expect(agent.followed[0]?.text).toContain('issue_open')
    expect(agent.followed[0]?.text).toContain('"crash on start"')
  })

  it('rejects an empty title and unknown subcommands', async () => {
    const services = await loaded()
    expect((await services.commands.run('issue', 'open   ', new MockAgent())).kind).toBe('error')
    expect((await services.commands.run('issue', 'list', new MockAgent())).kind).toBe('error')
  })
})
