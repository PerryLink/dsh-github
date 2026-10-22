// Verify the built artifacts after `pnpm run build`: the shipped files the
// plugin needs are present, the host bundle parses under plain Node, and the
// host face imports with the expected plugin contract (name === 'dsh-github',
// apply is a function, no default export). Guards against TypeScript-only
// syntax leaking into shipped output and against a tarball missing the
// bundle patch or the Action contract.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))

const required = [
  'lib/index.js',
  'lib/index.d.ts',
  'lib/client.js',
  'action.yml',
  'cordis.patch.yml',
]
for (const rel of required) {
  if (!existsSync(path.join(root, rel))) throw new Error(`missing artifact: ${rel}`)
}

execFileSync(process.execPath, ['--check', path.join(root, 'lib/index.js')], { stdio: 'inherit' })

const registrations = []
runInNewContext(readFileSync(path.join(root, 'lib/client.js'), 'utf8'), {
  window: { __ModuleLoader__: { load: registration => registrations.push(registration) } },
})
if (registrations.length !== 1) {
  throw new Error(`lib/client.js must register exactly one factory, registered ${String(registrations.length)}`)
}
if (registrations[0].id !== pkg.name) {
  throw new Error(`lib/client.js registers ${JSON.stringify(registrations[0].id)}, expected ${JSON.stringify(pkg.name)}`)
}
if (typeof registrations[0].factory !== 'function') throw new Error('lib/client.js registered a non-function factory')

const index = await import(pathToFileURL(path.join(root, 'lib/index.js')).href)
if ('default' in index) throw new Error('lib/index.js must not carry a default export')
if (index.name !== 'dsh-github' || typeof index.apply !== 'function') {
  throw new Error('lib/index.js exports an unexpected plugin face')
}

console.log('artifacts OK: host face + browser registration id + bundle patch and action contract present')
