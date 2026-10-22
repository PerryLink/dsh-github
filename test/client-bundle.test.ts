import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

describe('shipped browser bundle', () => {
  it('is a classic-script loader factory, not bare ESM', () => {
    expect(bundle.startsWith('window.__ModuleLoader__.load({')).toBe(true)
    expect(bundle).toContain(`id: ${JSON.stringify(pkg.name)}`)
    expect(/^import\s/m.test(bundle)).toBe(false)
    expect(/^export\s/m.test(bundle)).toBe(false)
  })

  it('registers exactly once under the package name', () => {
    const registrations = []
    runInNewContext(bundle, {
      window: { __ModuleLoader__: { load: registration => registrations.push(registration) } },
    })
    expect(registrations).toHaveLength(1)
    expect(registrations[0].id).toBe(pkg.name)
    expect(typeof registrations[0].factory).toBe('function')
  })
})
