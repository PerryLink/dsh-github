/**
 * Emit `lib/client.js` — the browser half in the shape the DSH client module
 * loader installs — from `src/client.ts`.
 *
 * `tsc` also writes `lib/client.js`, as ordinary ESM, for the Node-side
 * project. This step replaces that file (and its sourcemap) with the
 * registration bundle; `lib/client.d.ts` stays tsc's declaration emit and the
 * published `./client` types stay the hand-authored `lib/types/client.d.ts`.
 * The artifact is built and self-checked in memory, so a bundle the loader
 * cannot install never reaches disk.
 *
 * Usage: node scripts/build-client.mjs [--check]
 *   --check  build and self-check without writing (used by the test suite)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertClientBundle, bundleClient } from './client-bundle.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const checkOnly = process.argv.includes('--check')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const { code, map, externals } = await bundleClient({ root, pkg })
const exports = assertClientBundle(code, pkg.name)

if (!checkOnly) {
  mkdirSync(join(root, 'lib'), { recursive: true })
  writeFileSync(join(root, 'lib', 'client.js'), code)
  writeFileSync(join(root, 'lib', 'client.js.map'), map)
}

const exported = Object.keys(exports).sort()
console.log(
  `client bundle: ${pkg.name} ${checkOnly ? 'checked' : '→ lib/client.js'} `
  + `(${Buffer.byteLength(code)} bytes, ${externals.length} module-table externals, ${exported.length} exports: ${exported.join(', ')})`,
)
