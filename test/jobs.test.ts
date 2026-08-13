import { describe, expect, it } from 'vitest'
import { createState } from '../src/state.ts'
import { startReviewJob } from '../src/jobs.ts'
import { Config } from '../src/index.ts'
import { MockAgent, MockJobs, MockCredentials, jsonResponse, stubFetch, TOKEN } from './helpers.ts'

const DIFF = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1,2 @@\n x\n+// TODO: later\n'

function makeState(routes: Array<{ match: (m: string, u: URL) => boolean; respond: () => Response }>) {
  const credentials = new MockCredentials()
  credentials.values.set('GITHUB_TOKEN', TOKEN)
  const config = Config({ reviewJobTimeoutMs: 5000, retryBaseMs: 1 }) as never
  const state = createState({ credentials }, config, async () => { throw new Error('unused') }, async () => { throw new Error('unused') }, stubFetch(routes))
  return { state, credentials }
}

describe('review job lifecycle', () => {
  it('completes with a findings summary and a recorded report', async () => {
    const { state } = makeState([{
      match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7',
      respond: () => new Response(DIFF, { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    }])
    const jobs = new MockJobs()
    const id = startReviewJob(jobs, state, { repo: 'o/r', pr: 7, label: 'review PR #7', owner: new MockAgent() })
    const done = await jobs.hooks(id).done
    expect(done.status).toBe('completed')
    expect(done.output).toContain('1 finding(s)')
    expect(state.records.get(id)?.status).toBe('completed')
    expect(state.records.get(id)?.report?.findings).toHaveLength(1)
    expect(state.records.get(id)?.report?.postBody).toContain('todo-marker')
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
