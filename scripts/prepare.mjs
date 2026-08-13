// Self-contained prepare hook for git-installed packages.
//
// pnpm runs this after `dsh plugin add "github:owner/repo#<sha>"` once the
// user allowlists the build (allowBuilds in the profile pnpm-workspace.yaml).
// A git install has no devDependencies, so the script must work without
// typescript being resolvable: it falls back to the committed lib/ artifacts,
// and fails loud when neither a compiler nor build artifacts exist.
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const lib = join(root, 'lib')
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')

if (existsSync(tsc)) {
  const result = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--noEmitOnError'], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    process.exit(typeof result.status === 'number' ? result.status : 1)
  }
  process.exit(0)
}

if (existsSync(join(lib, 'index.js'))) {
  // Committed build artifacts: usable without a compiler.
  process.exit(0)
}

console.error('dsh-github prepare: no TypeScript compiler and no committed lib/ artifacts — build failed')
process.exit(1)
