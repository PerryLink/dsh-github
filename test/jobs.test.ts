import { describe, expect, it } from 'vitest'
import { createState } from '../src/state.ts'
import { startReviewJob } from '../src/jobs.ts'
import { Config } from '../src/index.ts'
import type { SubagentsService } from '../src/types.ts'
import { MockAgent, MockJobs, MockCredentials, jsonResponse, stubFetch, TOKEN } from './helpers.ts'

const DIFF = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1,2 @@\n x\n+// TODO: later\n'

const PULL_PAYLOAD = {
  number: 7,
  title: 'feat: shiny',
  state: 'open',
  html_url: 'https://github.com/o/r/pull/7',
  user: { login: 'alice' },
  head: { ref: 'feat/shiny', sha: 'abc123' },
  base: { ref: 'main' },
}

const accept = (init?: RequestInit): string => String((init?.headers as Record<string, string> | undefined)?.Accept ?? '')

/** Routes serving PR metadata (JSON), the diff, CI, and comments. */
const FULL_ROUTES = [
  { match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) !== 'application/vnd.github.diff', respond: () => jsonResponse(200, PULL_PAYLOAD) },
  { match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) === 'application/vnd.github.diff', respond: () => new Response(DIFF, { status: 200, headers: { 'Content-Type': 'text/plain' } }) },
  { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/commits/abc123/check-runs', respond: () => jsonResponse(200, { check_runs: [{ name: 'CI', status: 'completed', conclusion: 'success' }] }) },
  { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7/comments', respond: () => jsonResponse(200, [{ id: 1, body: 'nice', user: { login: 'bob' } }, { id: 2, body: 'ok', user: { login: 'carol' } }]) },
]

function makeState(routes: Array<{ match: (m: string, u: URL, i?: RequestInit) => boolean; respond: () => Response }>, options: { config?: Record<string, unknown>; subagents?: SubagentsService } = {}) {
  const credentials = new MockCredentials()
  credentials.values.set('GITHUB_TOKEN', TOKEN)
  const config = Config({ reviewJobTimeoutMs: 5000, retryBaseMs: 1, ...options.config }) as never
  const state = createState({ credentials, subagents: options.subagents }, config, async () => { throw new Error('unused') }, async () => { throw new Error('unused') }, stubFetch(routes))
  return { state, credentials }
}

/** Minimal subagent seam mock for model-review tests. */
class MockSubagents implements SubagentsService {
  names: string[] = ['spawn']
  outcomes: Array<{ output: string; stopReason: string }> = []
  calls: Array<{ provider: string; prompt: string; parent: unknown }> = []

  list(): string[] {
    return this.names
  }

  async start(name: string, request: { prompt: Array<{ type: 'text'; text: string }>; parent: unknown }): Promise<{
    result: Promise<{ output: Array<{ type: string; text: string }>; stopReason: string }>
    dispose(): Promise<void>
  }> {
    this.calls.push({ provider: name, prompt: request.prompt.map(block => block.text).join('\n'), parent: request.parent })
    const outcome = this.outcomes.shift() ?? { output: 'model review text', stopReason: 'completed' }
    return {
      result: Promise.resolve({ output: [{ type: 'text', text: outcome.output }], stopReason: outcome.stopReason }),
      dispose: async () => {},
    }
  }
}

describe('review job lifecycle', () => {
  it('completes with findings, head SHA, CI summary, and comment count', async () => {
    const { state } = makeState(FULL_ROUTES)
    const jobs = new MockJobs()
    const id = startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent() })
    const done = await jobs.hooks(id).done
    expect(done.status).toBe('completed')
    expect(done.output).toContain('1 finding(s)')
    expect(done.output).toContain('CI: 1 check(s), 0 pending, 0 failed')
    expect(done.output).toContain('existing review comments: 2')
    expect(state.records.get(id)?.status).toBe('completed')
    expect(state.records.get(id)?.headSha).toBe('abc123')
    expect(state.records.get(id)?.report?.findings).toHaveLength(1)
    expect(state.records.get(id)?.report?.postBody).toContain('todo-marker')
  })

  it('notes supplementary fetch failures without failing the job', async () => {
    const { state } = makeState([
      FULL_ROUTES[0] as never,
      FULL_ROUTES[1] as never,
      { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/commits/abc123/check-runs', respond: () => jsonResponse(403, { message: 'denied' }) },
      { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7/comments', respond: () => jsonResponse(500, { message: 'boom' }) },
    ])
    const jobs = new MockJobs()
    const id = startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent() })
    const done = await jobs.hooks(id).done
    expect(done.status).toBe('completed')
    expect(done.output).toContain('CI: unavailable')
    expect(done.output).toContain('existing review comments: unavailable')
  })

  it('honors per-job options: includeCi and includeComments off', async () => {
    let diffCalls = 0
    let ciCalls = 0
    let commentCalls = 0
    const routes = [
      { match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) !== 'application/vnd.github.diff', respond: () => jsonResponse(200, PULL_PAYLOAD) },
      {
        match: (m: string, u: URL, i?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && accept(i) === 'application/vnd.github.diff',
        respond: () => { diffCalls += 1; return new Response(DIFF, { status: 200, headers: { 'Content-Type': 'text/plain' } }) },
      },
      { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/commits/abc123/check-runs', respond: () => { ciCalls += 1; return jsonResponse(200, { check_runs: [] }) } },
      { match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7/comments', respond: () => { commentCalls += 1; return jsonResponse(200, []) } },
    ]
    const { state } = makeState(routes)
    const jobs = new MockJobs()
    const id = startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent(), includeCi: false, includeComments: false })
    const done = await jobs.hooks(id).done
    expect(done.status).toBe('completed')
    expect(done.output).not.toContain('CI:')
    expect(done.output).not.toContain('existing review comments')
    expect(diffCalls).toBe(1)
    expect(ciCalls).toBe(0)
    expect(commentCalls).toBe(0)
  })

  it('fails with token configuration guidance when no token exists', async () => {
    const { state, credentials } = makeState([{
      match: () => true,
      respond: () => jsonResponse(200, {}),
    }])
    credentials.values.clear()
    const jobs = new MockJobs()
    const id = startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent() })
    const done = await jobs.hooks(id).done
    expect(done.status).toBe('failed')
    expect(done.detail).toBe('no GitHub token')
    expect(done.output).toContain('gh auth login')
    expect(JSON.stringify(done)).not.toContain(TOKEN)
  })

  it('fails with the API error when the PR is missing', async () => {
    const { state } = makeState([{
      match: () => true,
      respond: () => jsonResponse(404, { message: 'Not Found' }),
    }])
    const jobs = new MockJobs()
    const id = startReviewJob(jobs, state, { repo: 'o/r', pr: 999, label: 'review PR #999', owner: new MockAgent() })
    const done = await jobs.hooks(id).done
    expect(done.status).toBe('failed')
    expect(done.detail).toContain('Not Found')
    expect(state.records.get(id)?.status).toBe('failed')
  })

  it('settles as killed when cancelled mid-flight', async () => {
    // Token resolution hangs until the job's own signal aborts it, making the
    // cancellation path deterministic.
    const credentials = new MockCredentials()
    credentials.values.set('GITHUB_TOKEN', TOKEN)
    const config = Config({ tokenSource: 'gh', reviewJobTimeoutMs: 5000 }) as never
    const state = createState({ credentials }, config, async () => { throw new Error('unused') }, (args, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }), stubFetch([]))
    const jobs = new MockJobs()
    const id = startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent() })
    expect(jobs.kill(id, undefined, 'user stop')).toBe('requested')
    const done = await jobs.hooks(id).done
    expect(done.status).toBe('killed')
    expect(done.detail).toBe('user stop')
    expect(state.records.get(id)?.status).toBe('killed')
  })

  it('fails with a timeout detail when the deadline elapses', async () => {
    const config = Config({ tokenSource: 'gh', reviewJobTimeoutMs: 1000 }) as never
    const credentials = new MockCredentials()
    credentials.values.set('GITHUB_TOKEN', TOKEN)
    // Token resolution hangs until the job's own timeout aborts it.
    const state = createState({ credentials }, config, async () => { throw new Error('unused') }, (args, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }), stubFetch([]))
    const jobs = new MockJobs()
    const id = startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent() })
    const done = await jobs.hooks(id).done
    expect(done.status).toBe('failed')
    expect(done.detail).toBe('timeout')
    expect(state.records.get(id)?.status).toBe('failed')
  }, 5000)

  it('refuses to start when the registry has no controller for the owner', () => {
    const { state } = makeState([{ match: () => true, respond: () => jsonResponse(200, {}) }])
    const jobs = new MockJobs()
    jobs.refuseStart = true
    expect(() => startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent() })).toThrowError(/controller/)
  })
})

describe('model review (subagent seam)', () => {
  it('delegates the capped diff to a one-shot subagent and stores its output', async () => {
    const subagents = new MockSubagents()
    const { state } = makeState(FULL_ROUTES, { config: { reviewMode: 'model' }, subagents })
    const jobs = new MockJobs()
    const id = startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent() })
    const done = await jobs.hooks(id).done
    expect(done.status).toBe('completed')
    expect(done.detail).toContain('model review')
    expect(done.output).toBe('model review text')
    expect(state.records.get(id)?.report?.postBody).toBe('model review text')
    expect(state.records.get(id)?.report?.findings).toEqual([])
    expect(subagents.calls).toHaveLength(1)
    expect(subagents.calls[0]?.provider).toBe('spawn')
    expect(subagents.calls[0]?.prompt).toContain('READ-ONLY')
    expect(subagents.calls[0]?.prompt).toContain('+// TODO: later')
  })

  it('honors a configured modelReviewProvider', async () => {
    const subagents = new MockSubagents()
    const { state } = makeState(FULL_ROUTES, { config: { reviewMode: 'model', modelReviewProvider: 'acp' }, subagents })
    const jobs = new MockJobs()
    const id = startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent() })
    await jobs.hooks(id).done
    expect(subagents.calls[0]?.provider).toBe('acp')
  })

  it('fails the job when the subagent run stops short of completion', async () => {
    const subagents = new MockSubagents()
    subagents.outcomes.push({ output: 'partial', stopReason: 'max-tokens' })
    const { state } = makeState(FULL_ROUTES, { config: { reviewMode: 'model' }, subagents })
    const jobs = new MockJobs()
    const id = startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent() })
    const done = await jobs.hooks(id).done
    expect(done.status).toBe('failed')
    expect(done.detail).toBe('model review: max-tokens')
    expect(state.records.get(id)?.status).toBe('failed')
  })

  it('fails the job with guidance when no provider is registered', async () => {
    const subagents = new MockSubagents()
    subagents.names = []
    const { state } = makeState(FULL_ROUTES, { config: { reviewMode: 'model' }, subagents })
    const jobs = new MockJobs()
    const id = startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent() })
    const done = await jobs.hooks(id).done
    expect(done.status).toBe('failed')
    expect(done.detail).toBe('no subagent provider')
  })

  it('refuses to start model review without the subagent seam', () => {
    const { state } = makeState(FULL_ROUTES, { config: { reviewMode: 'model' } })
    const jobs = new MockJobs()
    expect(() => startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent() })).toThrowError(/subagent seam/)
  })
})
