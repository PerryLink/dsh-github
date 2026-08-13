import { describe, expect, it } from 'vitest'
import { Config } from '../src/index.ts'

describe('Config schema', () => {
  it('applies defaults for an empty object', () => {
    const resolved = Config({}) as Record<string, unknown>
    expect(resolved.tokenSource).toBe('auto')
    expect(resolved.tokenRef).toBe('GITHUB_TOKEN')
    expect(resolved.autoCommit).toBe(false)
    expect(resolved.maxDiffChars).toBe(8000)
    expect(resolved.reviewJobTimeoutMs).toBe(600_000)
    expect(resolved.maxRetries).toBe(3)
    expect(resolved.apiBaseUrl).toBe('https://api.github.com')
    expect(resolved.allowedActions).toEqual(['pr.create', 'review.post', 'issue.create'])
    expect(resolved.defaultOwnerRepo).toBeUndefined()
    expect(resolved.workspaceDir).toBeUndefined()
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
  })

  it('fails loud on unknown write actions in the whitelist', () => {
    expect(() => Config({ allowedActions: ['merge.push'] })).toThrowError(/allowedActions/)
  })

  it('preserves explicit overrides', () => {
    const resolved = Config({ tokenSource: 'gh', maxDiffChars: 1234, autoCommit: true }) as Record<string, unknown>
    expect(resolved.tokenSource).toBe('gh')
    expect(resolved.maxDiffChars).toBe(1234)
    expect(resolved.autoCommit).toBe(true)
  })
})
