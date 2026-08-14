import { describe, expect, it } from 'vitest'
import { createState, type ReviewJobRecord } from '../src/state.ts'
import { Config } from '../src/index.ts'
import { MockCredentials, TOKEN } from './helpers.ts'

function makeState(maxReviewRecords = 3) {
  const credentials = new MockCredentials()
  credentials.values.set('GITHUB_TOKEN', TOKEN)
  const config = Config({ maxReviewRecords }) as never
  const state = createState({ credentials }, config, async () => { throw new Error('unused') }, async () => { throw new Error('unused') })
  return state
}

function record(status: ReviewJobRecord['status']): ReviewJobRecord {
  return { status, repo: 'o/r', pr: 1, report: null }
}

describe('review-job record cap (maxReviewRecords)', () => {
  it('evicts the oldest settled record past the cap, never running ones', () => {
    const state = makeState(3)
    state.rememberRecord('github-review-1', record('completed'))
    state.rememberRecord('github-review-2', record('failed'))
    state.rememberRecord('github-review-3', record('killed'))
    state.rememberRecord('github-review-4', record('completed'))
    expect(state.records.has('github-review-1')).toBe(false)
    expect(state.records.has('github-review-2')).toBe(true)
    expect(state.records.has('github-review-3')).toBe(true)
    expect(state.records.has('github-review-4')).toBe(true)
  })

  it('keeps every record when only running jobs exceed the cap', () => {
    const state = makeState(2)
    state.rememberRecord('github-review-1', record('running'))
    state.rememberRecord('github-review-2', record('running'))
    state.rememberRecord('github-review-3', record('running'))
    expect(state.records.size).toBe(3)
    expect(state.records.has('github-review-1')).toBe(true)
  })
})
