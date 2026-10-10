// Verify the built artifacts after `pnpm run build`: the shipped files the
// plugin needs are present, the host bundle parses under plain Node, and the
// host face imports with the expected plugin contract (name === 'dsh-github',
// apply is a function, no default export). Guards against TypeScript-only
// syntax leaking into shipped output and against a tarball missing the
// bundle patch or the Action contract.
//
// The browser half is checked separately and in its own shape: the DSH web
// shell installs `lib/client.js` as a classic script, so plain ESM there is
// the failure this file exists to catch, not something `node --check` can
// see (this package is `"type": "module"`, which makes that parse it as ESM).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { assertClientBundle } from './client-bundle.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))

const required = [
  'lib/index.js',
  'lib/index.d.ts',
  'lib/client.js',
  'lib/types/client.d.ts',
  'action.yml',
  'cordis.patch.yml',
]
for (const rel of required) {
  if (!existsSync(path.join(root, rel))) throw new Error(`missing artifact: ${rel}`)
}

execFileSync(process.execPath, ['--check', path.join(root, 'lib/index.js')], { stdio: 'inherit' })

const index = await import(pathToFileURL(path.join(root, 'lib/index.js')).href)
if ('default' in index) throw new Error('lib/index.js must not carry a default export')
if (index.name !== 'dsh-github' || typeof index.apply !== 'function') {
  throw new Error('lib/index.js exports an unexpected plugin face')
}

const clientRel = pkg.exports?.['./client']?.default
if (typeof clientRel !== 'string') throw new Error('package.json exports["./client"].default must name the browser bundle')
const client = readFileSync(path.join(root, clientRel), 'utf8')
assertClientBundle(client, pkg.name)

console.log('artifacts OK: syntax + ESM import + browser bundle registration + bundle patch and action contract present')
