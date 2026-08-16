/**
 * Pure-function coverage for the UI-card presenters.
 *
 * Presenters must remain pure functions of their arguments (they run on live
 * streaming AND on log replay), so these tests call them directly with
 * canonical values and assert the card shapes. The new v0.5.0 cards
 * (pr_merge / pr_update / gh_repo / gh_file) plus the review_post body-size
 * indicator are covered here alongside the error variants.
 * @module dsh-github/test/present
 */
import { describe, expect, it } from 'vitest'
import {
  ghFileCall, ghFileResult, ghRepoCall, ghRepoResult,
  prMergeCall, prMergeResult, prUpdateCall, prUpdateResult, reviewPostCall,
} from '../src/present.ts'

describe('pr_merge presenters', () => {
  it('shows a pending card with the merge facts', () => {
    expect(prMergeCall({ pr: 'o/r#7', mergeMethod: 'squash', deleteBranch: true })).toMatchObject({
      card: 'generic',
      title: 'Merge pull request o/r#7',
      rawInput: { pr: 'o/r#7', mergeMethod: 'squash', deleteBranch: true },
    })
  })

  it('shows the merged outcome, including the branch-delete note', () => {
    const view = prMergeResult({ pr: '7' }, {
      content: [], isError: false,
      meta: { status: 'merged', merged: true, sha: 's', message: 'Pull Request successfully merged', url: 'https://github.com/o/r/pull/7', branchDeleted: true, rateLimit: { remaining: 1, resetAt: null } },
    })
    expect(view).toMatchObject({ card: 'generic', title: 'Pull request merged' })
    expect(view?.content?.[0]?.text).toContain('head branch deleted')
  })

  it('shows a readable failure when the merge did not happen', () => {
    const view = prMergeResult({ pr: '7' }, {
      content: [], isError: false,
      meta: { status: 'error', code: 'github-api', message: 'GitHub API 405: not mergeable' },
    })
    expect(view).toMatchObject({ card: 'generic', title: 'Pull request not merged' })
  })
})

describe('pr_update presenters', () => {
  it('shows a pending card with only the edits present', () => {
    expect(prUpdateCall({ pr: 'o/r#7', title: 'renamed', state: 'closed' })).toMatchObject({
      card: 'generic',
      title: 'Update pull request o/r#7',
      rawInput: { pr: 'o/r#7', title: 'renamed', state: 'closed' },
    })
  })

  it('shows the updated outcome', () => {
    const view = prUpdateResult({ pr: '7' }, {
      content: [], isError: false,
      meta: { status: 'updated', url: 'https://github.com/o/r/pull/7', number: 7, title: 'renamed', state: 'closed', base: 'main', rateLimit: { remaining: null, resetAt: null } },
    })
    expect(view).toMatchObject({ card: 'generic', title: 'Updated pull request #7' })
  })
})

describe('gh_repo presenters', () => {
  it('shows a pending card that omits the optional repo', () => {
    expect(ghRepoCall({})).toMatchObject({ card: 'generic', rawInput: {} })
    expect(ghRepoCall({ ownerRepo: 'o/r' })).toMatchObject({ card: 'generic', title: 'Repository metadata: o/r' })
  })

  it('shows the repository facts', () => {
    const view = ghRepoResult({}, {
      content: [], isError: false,
      meta: { repo: 'o/r', description: 'desc', defaultBranch: 'main', visibility: 'public', stars: 5, forks: 2, openIssues: 1, language: 'TypeScript', license: 'Apache-2.0', topics: [], url: 'https://github.com/o/r', updatedAt: '2026-01-01T00:00:00Z', rateLimit: { remaining: null, resetAt: null } },
    })
    expect(view).toMatchObject({ card: 'generic', title: 'o/r' })
    expect(view?.content?.[0]?.text).toContain('⭐ 5')
  })
})

describe('gh_file presenters', () => {
  it('shows a pending card with the path', () => {
    expect(ghFileCall({ path: 'src/a.ts', ref: 'main' })).toMatchObject({
      card: 'generic', title: 'Read file: src/a.ts', rawInput: { path: 'src/a.ts', ref: 'main' },
    })
  })

  it('shows size, truncation, and a bounded preview', () => {
    const view = ghFileResult({ path: 'a.ts' }, {
      content: [], isError: false,
      meta: { repo: 'o/r', path: 'a.ts', ref: 'main', size: 100, truncated: true, content: 'line1\nline2\n', sha: 'abcdef0123', url: 'https://github.com/o/r/blob/main/a.ts', rateLimit: { remaining: null, resetAt: null } },
    })
    expect(view).toMatchObject({ card: 'generic', title: 'o/r/a.ts @ main' })
    expect(view?.content?.[0]?.text).toContain('100 bytes (truncated)')
    expect(view?.content?.[0]?.text).toContain('line1')
  })
})

describe('review_post pending card', () => {
  it('carries the body override as a character count, not the body text', () => {
    const view = reviewPostCall({ jobId: 'github-review-1', mode: 'inline', body: 'a'.repeat(500) })
    expect(view).toMatchObject({ card: 'generic', rawInput: { jobId: 'github-review-1', mode: 'inline', bodyChars: 500 } })
    expect(JSON.stringify(view)).not.toContain('a'.repeat(500))
    expect(reviewPostCall({ jobId: 'github-review-2' })).toMatchObject({ rawInput: { jobId: 'github-review-2' } })
  })
})
