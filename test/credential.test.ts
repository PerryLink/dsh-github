import { afterEach, describe, expect, it } from 'vitest'
import { resolveToken } from '../src/credential.ts'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { TOKEN } from './helpers.ts'

const credentials = { resolve: async () => undefined } as unknown as CredentialProvider

function ghRunner(behavior: 'ok' | 'fail' | 'empty' = 'ok') {
  return async (): Promise<{ stdout: string }> => {
    if (behavior === 'fail') throw new Error('gh: not logged in')
    return { stdout: behavior === 'empty' ? '\n' : `${TOKEN}\n` }
  }
}

describe('resolveToken', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    delete process.env.GITHUB_TOKEN
  })

  it('resolves from the credentials seam first in auto order', async () => {
    const seam = {
      resolve: async (ref: string) => (String(ref) === 'GITHUB_TOKEN' ? { value: TOKEN, source: 'env' } : undefined),
    } as unknown as CredentialProvider
    const result = await resolveToken(seam, 'auto', 'GITHUB_TOKEN', ghRunner())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.token).toEqual({ value: TOKEN, source: 'credentials' })
  })

  it('falls back to the environment variable', async () => {
    process.env.GITHUB_TOKEN = TOKEN
    const result = await resolveToken(credentials, 'auto', 'GITHUB_TOKEN', ghRunner('fail'))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.token).toEqual({ value: TOKEN, source: 'env' })
  })

  it('falls back to the gh CLI token', async () => {
    const result = await resolveToken(credentials, 'auto', 'GITHUB_TOKEN', ghRunner('ok'))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.token).toEqual({ value: TOKEN, source: 'gh' })
  })

  it('ignores an empty gh CLI output', async () => {
    const result = await resolveToken(credentials, 'auto', 'GITHUB_TOKEN', ghRunner('empty'))
    expect(result.ok).toBe(false)
  })

  it('returns a structured error with guidance when nothing resolves', async () => {
    const result = await resolveToken(credentials, 'auto', 'GITHUB_TOKEN', ghRunner('fail'))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('no-token')
      expect(result.error.guidance).toContain('gh auth login')
      expect(result.error.message).not.toContain(TOKEN)
    }
  })

  it('restricts to a single explicit source', async () => {
    process.env.GITHUB_TOKEN = TOKEN
    const result = await resolveToken(credentials, 'gh', 'GITHUB_TOKEN', ghRunner('fail'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('gh')
  })

  it('rejects an invalid tokenRef identifier without crashing', async () => {
    const result = await resolveToken(credentials, 'credentials', '9BAD', ghRunner())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('9BAD')
  })

  it('never leaks the token into failure messages', async () => {
    const seam = {
      resolve: async () => { throw new Error(`boom ${TOKEN}`) },
    } as unknown as CredentialProvider
    const result = await resolveToken(seam, 'auto', 'GITHUB_TOKEN', ghRunner('fail')).catch(error => error)
    // A throwing provider propagates; the structured path must never embed the token.
    expect(JSON.stringify(result)).not.toContain(TOKEN)
  })
})
