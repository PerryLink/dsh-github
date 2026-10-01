/**
 * Client bundle module-loader contract (pure static + one sandboxed run).
 *
 * The host's browser module system (`@deepseek-ai/dsh-client-modules`) is a lazy
 * CJS table: executing a client bundle must only REGISTER a factory through
 * `window.__ModuleLoader__.load({ id, factory })`, and every module body side
 * effect lives inside that factory, which the loader materializes with a
 * `require` of its own. A bundle that keeps its top-level `export` bindings
 * registers nothing and the browser reports
 *
 *   client-modules: could not load "<pkg>": <url>:
 *     loaded without registering "<pkg>" via __ModuleLoader__.load
 *
 * `tsc` emits ESM, so `scripts/build-client.mjs` rewrites the compiled file.
 * This test executes the SHIPPED artifact the way the loader does — run the
 * bundle against a stub `__ModuleLoader__`, then materialize the captured
 * factory with stub requires — so a regression in that rewrite fails here
 * instead of in a browser.
 * @module dsh-github/test/client-bundle-contract
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string
  dsh: { client: { inject?: string[] } }
}
const bundle = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

interface Registered {
  id: string
  factory: (require: (specifier: string) => unknown) => Record<string, unknown>
}

/** Run the bundle exactly as the browser loader does and return what it registered. */
function loadBundle(): Registered {
  const registrations: Registered[] = []
  const context = createContext({
    window: {
      __ModuleLoader__: {
        load: (entry: Registered) => {
          registrations.push(entry)
        },
      },
    },
  })
  runInContext(bundle, context)
  expect(registrations, 'the bundle registered no factory').toHaveLength(1)
  return registrations[0]
}

/** The bundle's own two dependencies; anything else is an undeclared import. */
function requireStub(specifier: string): unknown {
  switch (specifier) {
    case 'react':
      return { createElement: () => null, useState: (initial: unknown) => [initial, () => {}] }
    case '@deepseek-ai/dsh-client-ui-primitives':
      return { Button: () => null, IconLoadingOutlineRegular: () => null }
    default:
      throw new Error(
        `bundle required "${specifier}", which this test does not stub — ` +
          'declare it in dsh.client.inject and add it here',
      )
  }
}

describe('lib/client.js module-loader contract', () => {
  it('carries no top-level ESM syntax', () => {
    const offending = bundle
      .split('\n')
      .filter((line) => /^(?:import|export)\s/.test(line))
    expect(offending, 'top-level ESM survived the wrap').toEqual([])
  })

  it('registers a factory under the package name', () => {
    const entry = loadBundle()
    expect(entry.id).toBe(manifest.name)
    expect(typeof entry.factory).toBe('function')
  })

  it('materializes the plugin face the loader consumes', () => {
    const exports = loadBundle().factory(requireStub)
    expect(typeof exports.apply).toBe('function')
    expect(exports.inject).toEqual(['slots', 'locale', 'connection', 'remote', 'remote.credentials'])
    expect(exports.NS).toBe('dsh-github')
  })

  it('declares every module the bundle requires in dsh.client.inject', () => {
    const inject = manifest.dsh.client.inject ?? []
    const required = [...bundle.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((match) => match[2])
    expect(required.length, 'the bundle requires nothing — did the wrap drop its imports?').toBeGreaterThan(0)
    for (const specifier of required) {
      // A subpath such as `react/jsx-runtime` is answered by its package row.
      const packageRow = specifier.startsWith('@')
        ? specifier.split('/').slice(0, 2).join('/')
        : specifier.split('/')[0]
      expect(inject, `"${specifier}" is not declared in dsh.client.inject`).toContain(packageRow)
    }
  })
})
