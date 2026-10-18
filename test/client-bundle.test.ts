import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('shipped browser bundle', () => {
  it('is a classic-script loader factory, not bare ESM', () => {
    const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    expect(source.startsWith('window.__ModuleLoader__.load({')).toBe(true)
    expect(source).toContain('id: "dsh-github"')
    expect(/^import\s/m.test(source)).toBe(false)
    expect(/^export\s/m.test(source)).toBe(false)
  })
})
