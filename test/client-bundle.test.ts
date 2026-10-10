/**
 * Browser-half artifact contract.
 *
 * The DSH web shell installs `exports["./client"].default` as a **classic
 * script** and expects it to hand its factory to
 * `window.__ModuleLoader__.load({ id, factory })`. 0.7.12 shipped plain `tsc`
 * output there instead — top-level `import`/`export` — so the browser threw
 * `SyntaxError: Cannot use import statement outside a module`, the combo batch
 * that file was concatenated into failed to parse as a whole, and every client
 * entry in it (59 of them, in the reported profile) stayed unactivated behind
 * a "Failed to load plugins" page.
 *
 * These tests pin the artifact so that regression cannot ship again: the
 * shipped file must execute as a classic script and register, and a fresh
 * build of `src/client.ts` must be what is committed.
 * @module dsh-github/test/client-bundle
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  assertClientBundle, bundleClient, clientExternals, loadClientBundle,
} from '../scripts/client-bundle.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const artifact = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const artifactMap = readFileSync(new URL('../lib/client.js.map', import.meta.url), 'utf8')

/** The shape `tsc` alone emits for `src/client.ts` — the 0.7.12 failure, verbatim in structure. */
const TSC_OUTPUT = [
  "import { createElement, useState } from 'react';",
  "import { Button, IconLoadingOutline16, } from '@deepseek-ai/dsh-client-ui-primitives';",
  "export const NS = 'dsh-github';",
  'export const inject = [\'slots\', \'locale\'];',
  'export function apply(ctx) { return ctx; }',
  '',
].join('\n')

describe('lib/client.js browser bundle', () => {
  it('executes as a classic script and registers the package id', () => {
    const exports = assertClientBundle(artifact, pkg.name)
    expect(typeof exports.apply).toBe('function')
    expect(Array.isArray(exports.inject)).toBe(true)
    expect(exports.inject).toContain('slots')
  })

  it('keeps every bare import on the loader module table', () => {
    const requested = [...new Set(
      [...artifact.matchAll(/\brequire\((['"])([^'"]+)\1\)/g)].map(match => match[2] as string),
    )]
    // A bundle with no `require` at all would pass vacuously and prove nothing.
    expect(requested.length).toBeGreaterThan(0)
    const allowed = new Set(clientExternals(pkg))
    for (const specifier of requested) {
      expect(allowed.has(specifier), `"${specifier}" is not a module-table row — the loader cannot answer it`).toBe(true)
    }
  })

  it('ships exactly what a fresh build of src/client.ts produces', async () => {
    const fresh = await bundleClient({ root, pkg })
    expect(artifact).toBe(fresh.code)
    expect(artifactMap).toBe(fresh.map)
  })

  it('rejects the plain tsc output that broke the plugin batch', () => {
    expect(() => loadClientBundle(TSC_OUTPUT, pkg.name)).toThrow(/not a classic script/)
    expect(() => assertClientBundle(TSC_OUTPUT, pkg.name)).toThrow(/not a classic script/)
  })
})
