import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const { name: pkgName } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { name: string }

describe('shipped browser bundle', () => {
  it('is a classic-script loader factory, not bare ESM', () => {
    const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    expect(source.startsWith('window.__ModuleLoader__.load({')).toBe(true)
    // The host keys client graph rows by package name; any other id leaves the
    // registration unresolvable and the host never imports it.
    expect(source).toContain(`id: ${JSON.stringify(pkgName)}`)
    expect(/^import\s/m.test(source)).toBe(false)
    expect(/^export\s/m.test(source)).toBe(false)
  })
})
