/**
 * Where the browser half mounts its card (pure static + one sandboxed run).
 *
 * The Plugins page declares three configuration seats and groups them apart:
 * `plugins.item` is rendered by `renderGroup("official", …)` — the Official
 * group, where the host's own settings plugins (agent-loop, shell, subagent,
 * web-search) mount their cards — while `plugins.row.config` renders inside one
 * bundle row's own detail view, in the Installed group. A community bundle that
 * takes the `plugins.item` seat is therefore presented as an official plugin
 * instead of an installed one.
 *
 * Both seats hand the card the same `{ view, form }` props, so the deployment
 * that keeps the official list clean is a change of seat, not of card. This test
 * pins that: the bundle must register `plugins.row.config` under this package's
 * own row key, and must not touch `plugins.item`.
 * @module dsh-github/test/client-card-seat
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string }
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
const bundle = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

/** The row id the bundle patch declares, read from the patch rather than restated. */
function declaredRowIds(): string[] {
  return [...patch.matchAll(/^\s*-\s*id:\s*(\S+)\s*$/gm)].map((match) => match[1])
}

interface Registration {
  options: Record<string, unknown>
}

/** Materialize the bundle and run its `apply` against a recording stub context. */
function applyCard(): { injected: string[]; registrations: Registration[] } {
  const registrations: Registration[] = []
  const injected: string[] = []
  const registered: Array<{
    id: string
    factory: (require: (specifier: string) => unknown) => Record<string, unknown>
  }> = []
  const context = createContext({
    window: {
      __ModuleLoader__: {
        load: (entry: (typeof registered)[number]) => {
          registered.push(entry)
        },
      },
    },
  })
  runInContext(bundle, context)
  const face = registered[0].factory((specifier: string) => {
    if (specifier === 'react') return { createElement: () => null, useState: (init: unknown) => [init, () => {}] }
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') {
      return { Button: () => null, IconLoadingOutlineRegular: () => null }
    }
    throw new Error(`undeclared require: ${specifier}`)
  })

  const ctx = {
    get: () => undefined,
    effect: () => {},
    locale: { bind: () => (key: string) => key, register: () => {} },
    remote: {
      $on: () => ({}),
      credentials: {
        describe: async () => ({ ok: true, value: {} }),
        set: async () => ({ ok: true }),
      },
    },
    slots: {
      inject: (slot: string, factory: () => unknown) => {
        injected.push(slot)
        factory()
      },
      register: (options: Record<string, unknown>) => {
        registrations.push({ options })
      },
    },
  }
  ;(face.apply as (context: unknown) => void)(ctx)
  return { injected, registrations }
}

describe('client card seat', () => {
  it('mounts on the bundle row, not in the official plugins list', () => {
    const { injected } = applyCard()
    expect(injected).toContain('plugins.row.config')
    expect(injected, 'the official list is for the host’s own settings plugins').not.toContain('plugins.item')
  })

  it('keys the row seat to the package and the row the patch declares', () => {
    const { registrations } = applyCard()
    expect(registrations).toHaveLength(1)
    const [registration] = registrations
    expect(registration.options.name).toBe('plugins.row.config')
    expect(registration.options.key).toBe(`${manifest.name}#${declaredRowIds()[0]}`)
  })

  it('declares a single constant row so the key stays derivable', () => {
    expect(declaredRowIds()).toEqual(['dsh-github'])
  })
})
