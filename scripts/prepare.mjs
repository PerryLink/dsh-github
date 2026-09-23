// Self-contained prepare hook for git-installed packages.
//
// pnpm runs this after `dsh plugin add "github:owner/repo#<sha>"` once the
// user allowlists the build (allowBuilds in the profile pnpm-workspace.yaml).
// A git install has no devDependencies, so the script must work without
// typescript or esbuild being resolvable: it then falls back to the committed
// lib/ artifacts, and fails loud when neither a toolchain nor usable artifacts
// exist.
//
// Both tools are required before tsc runs, and that is deliberate: tsc emits
// the browser half as plain ESM, so compiling without the bundle step would
// overwrite a good committed `lib/client.js` with a file the DSH client module
// loader cannot install — a parse error that takes the whole plugin batch down
// in the browser, which is worse than a failed install.
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { assertClientBundle } from './client-bundle.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const lib = join(root, 'lib')
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** Whether a package resolves from this install. */
const resolvable = (specifier) => {
  try {
    createRequire(join(root, 'package.json')).resolve(specifier)
    return true
  } catch {
    return false
  }
}

/** Run one build step, inheriting stdio, and exit on its failure. */
const run = (...args) => {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) {
    process.exit(typeof result.status === 'number' ? result.status : 1)
  }
}

/** Whether the on-disk browser half is the registration bundle the loader needs. */
const hasClientBundle = () => {
  const artifact = join(lib, 'client.js')
  if (!existsSync(artifact)) return false
  try {
    assertClientBundle(readFileSync(artifact, 'utf8'), pkg.name)
    return true
  } catch (error) {
    console.error(`dsh-github prepare: committed lib/client.js is not a browser bundle — ${error.message}`)
    return false
  }
}

if (existsSync(tsc) && resolvable('esbuild')) {
  run(tsc, '-p', 'tsconfig.json', '--noEmitOnError')
  // TS 5.9 does not rewrite `.ts` specifiers in declaration emit; fix them so
  // NodeNext declaration consumers can resolve lib.
  run(join(root, 'scripts', 'fix-dts.mjs'))
  // Replace the ESM file tsc just emitted with the loader bundle.
  run(join(root, 'scripts', 'build-client.mjs'))
  process.exit(0)
}

if (existsSync(join(lib, 'index.js')) && hasClientBundle()) {
  // Committed build artifacts: usable without a toolchain.
  process.exit(0)
}

console.error('dsh-github prepare: no TypeScript compiler + esbuild and no usable committed lib/ artifacts — build failed')
process.exit(1)
