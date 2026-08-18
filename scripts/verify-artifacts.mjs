// Verify the built artifacts after `pnpm run build`: the shipped files the
// plugin needs are present, the host bundle parses under plain Node, and the
// host face imports with the expected plugin contract (name === 'dsh-github',
// apply is a function, no default export). Guards against TypeScript-only
// syntax leaking into shipped output and against a tarball missing the
// bundle patch or the Action contract.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const required = [
  'lib/index.js',
  'lib/index.d.ts',
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

console.log('artifacts OK: syntax + ESM import + bundle patch and action contract present')
