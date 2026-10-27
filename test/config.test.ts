import { describe, expect, it } from 'vitest'
import { Config } from '../src/index.ts'
import { liveValue } from '../src/config.ts'

describe('Config schema', () => {
  it('applies defaults for an empty object', () => {
    const resolved = Config({}) as Record<string, unknown>
    expect(resolved.tokenSource).toBe('auto')
    expect(resolved.tokenRef).toBe('GITHUB_TOKEN')
    // A volatile field validates to its live reference, not to the stored value.
    expect(liveValue(resolved.githubToken as string | { get(): string })).toBe('')
    expect(resolved.autoCommit).toBe(false)
    expect(resolved.maxDiffChars).toBe(8000)
    expect(resolved.renderExcerptChars).toBe(2000)
    expect(resolved.maxComments).toBe(20)
    expect(resolved.maxReviewRecords).toBe(50)
    expect(resolved.maxFileChars).toBe(12000)
    expect(resolved.maxFindings).toBe(50)
    expect(resolved.maxLineLength).toBe(300)
    expect(resolved.reviewMode).toBe('static')
    expect(resolved.modelReviewProvider).toBeUndefined()
    expect(resolved.reviewJobTimeoutMs).toBe(600_000)
    expect(resolved.maxRetries).toBe(3)
    expect(resolved.apiBaseUrl).toBe('https://api.github.com')
    expect(resolved.allowedActions).toEqual(['pr.create', 'review.post', 'issue.create', 'issue.comment', 'issue.close', 'pr.merge', 'pr.update', 'ci.run'])
    expect(resolved.defaultOwnerRepo).toBeUndefined()
    expect(resolved.workspaceDir).toBeUndefined()
  })

  it('marks the token field volatile so the settings page can serve it', () => {
    const field = (Config as unknown as { dict: Record<string, { meta: { volatile?: boolean } }> }).dict.githubToken
    expect(field?.meta.volatile).toBe(true)
  })

  it('reads a value through its live reference, or as a plain value', () => {
    expect(liveValue({ get: () => 'typed' })).toBe('typed')
    expect(liveValue('plain')).toBe('plain')
  })

  it('fails loud on an invalid tokenSource', () => {
    expect(() => Config({ tokenSource: 'cloud' })).toThrowError(/tokenSource/)
  })

  it('fails loud on an invalid tokenRef identifier', () => {
    expect(() => Config({ tokenRef: '9BAD' })).toThrowError(/tokenRef/)
  })

  it('fails loud on a malformed defaultOwnerRepo', () => {
    expect(() => Config({ defaultOwnerRepo: 'just-owner' })).toThrowError(/defaultOwnerRepo/)
  })

  it('fails loud on non-natural number tunables', () => {
    expect(() => Config({ maxDiffChars: 0 })).toThrowError(/maxDiffChars/)
    expect(() => Config({ reviewJobTimeoutMs: -5 })).toThrowError(/reviewJobTimeoutMs/)
    expect(() => Config({ renderExcerptChars: 0 })).toThrowError(/renderExcerptChars/)
    expect(() => Config({ maxReviewRecords: 0 })).toThrowError(/maxReviewRecords/)
    expect(() => Config({ maxFileChars: 0 })).toThrowError(/maxFileChars/)
    expect(() => Config({ maxFindings: 0 })).toThrowError(/maxFindings/)
    expect(() => Config({ maxLineLength: 0 })).toThrowError(/maxLineLength/)
  })

  it('fails loud on unknown write actions in the whitelist', () => {
    expect(() => Config({ allowedActions: ['merge.push'] })).toThrowError(/allowedActions/)
  })

  it('accepts the extended write-action vocabulary', () => {
    const resolved = Config({ allowedActions: ['issue.comment', 'issue.close'] }) as Record<string, unknown>
    expect(resolved.allowedActions).toEqual(['issue.comment', 'issue.close'])
  })

  it('fails loud on an invalid reviewMode', () => {
    expect(() => Config({ reviewMode: 'gpt' })).toThrowError(/reviewMode/)
  })

  it('accepts model review configuration', () => {
    const resolved = Config({ reviewMode: 'model', modelReviewProvider: 'acp' }) as Record<string, unknown>
    expect(resolved.reviewMode).toBe('model')
    expect(resolved.modelReviewProvider).toBe('acp')
  })

  it('preserves explicit overrides', () => {
    const resolved = Config({ tokenSource: 'gh', maxDiffChars: 1234, autoCommit: true, renderExcerptChars: 500 }) as Record<string, unknown>
    expect(resolved.tokenSource).toBe('gh')
    expect(resolved.maxDiffChars).toBe(1234)
    expect(resolved.renderExcerptChars).toBe(500)
    expect(resolved.autoCommit).toBe(true)
  })
})
