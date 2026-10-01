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

// The client bundle must satisfy the browser module-loader contract, and `tsc`
// alone emits ESM that cannot register. Runs after either branch below; it is a
// no-op when the committed artifact is already wrapped.
const wrapClient = () => {
  const wrap = spawnSync(process.execPath, [join(root, 'scripts', 'build-client.mjs')], {
    cwd: root,
    stdio: 'inherit',
  })
  if (wrap.status !== 0) {
    process.exit(typeof wrap.status === 'number' ? wrap.status : 1)
  }
}

if (existsSync(tsc)) {
  const result = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--noEmitOnError'], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    process.exit(typeof result.status === 'number' ? result.status : 1)
  }
  // TS 5.9 does not rewrite `.ts` specifiers in declaration emit; fix them so
  // NodeNext declaration consumers can resolve lib.
  const fix = spawnSync(process.execPath, [join(root, 'scripts', 'fix-dts.mjs')], {
    cwd: root,
    stdio: 'inherit',
  })
  if (fix.status !== 0) {
    process.exit(typeof fix.status === 'number' ? fix.status : 1)
  }
  wrapClient()
  process.exit(0)
}

if (existsSync(join(lib, 'index.js'))) {
  // Committed build artifacts: usable without a compiler. The wrap step still
  // runs so a stale committed client bundle is repaired rather than shipped.
  wrapClient()
  process.exit(0)
}

console.error('dsh-github prepare: no TypeScript compiler and no committed lib/ artifacts — build failed')
process.exit(1)
