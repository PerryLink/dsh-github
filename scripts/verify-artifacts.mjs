// Verify the built artifacts after `pnpm run build`: the shipped files the
// plugin needs are present, the host bundle parses under plain Node, and the
// host face imports with the expected plugin contract (name === 'dsh-github',
// apply is a function, no default export). Guards against TypeScript-only
// syntax leaking into shipped output and against a tarball missing the
// bundle patch or the Action contract.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

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
execFileSync(process.execPath, ['--check', path.join(root, 'lib/client.js')], { stdio: 'inherit' })

const index = await import(pathToFileURL(path.join(root, 'lib/index.js')).href)
if ('default' in index) throw new Error('lib/index.js must not carry a default export')
if (index.name !== 'dsh-github' || typeof index.apply !== 'function') {
  throw new Error('lib/index.js exports an unexpected plugin face')
}

// The browser half must satisfy the host's lazy CJS module-loader contract:
// executing the bundle only REGISTERS a factory via window.__ModuleLoader__.load.
// A bundle that keeps top-level ESM bindings registers nothing and the browser
// reports `loaded without registering "<pkg>" via __ModuleLoader__.load`, so the
// shipped client is executed here the way the loader executes it.
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const client = readFileSync(path.join(root, 'lib/client.js'), 'utf8')
for (const line of client.split('\n')) {
  if (/^(?:import|export)\s/.test(line)) {
    throw new Error(`lib/client.js carries top-level ESM that cannot register: ${line}`)
  }
}

const registrations = []
runInContext(client, createContext({
  window: { __ModuleLoader__: { load: (entry) => registrations.push(entry) } },
}))
if (registrations.length !== 1) {
  throw new Error(`lib/client.js registered ${registrations.length} factories; expected exactly the package row`)
}
const [entry] = registrations
if (entry.id !== manifest.name) {
  throw new Error(`lib/client.js registered "${entry.id}" but the package is "${manifest.name}"`)
}
const clientFace = entry.factory((specifier) => {
  if (specifier === 'react') return { createElement: () => null, useState: (init) => [init, () => {}] }
  if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return { Button: () => null, IconLoadingOutlineRegular: () => null }
  throw new Error(`lib/client.js requires undeclared module "${specifier}"`)
})
if (typeof clientFace.apply !== 'function' || !Array.isArray(clientFace.inject)) {
  throw new Error('lib/client.js exports an unexpected plugin face')
}

console.log('artifacts OK: syntax + ESM import + module-loader registration + bundle patch and action contract present')
