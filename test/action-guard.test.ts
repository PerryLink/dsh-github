/**
 * Local-machine protection for the action scripts (P2-7 hardening).
 *
 * `action-patch.mjs` and `action-post.mjs` resolve their paths from the
 * GitHub Actions runner environment. Run outside a runner (RUNNER_TEMP and
 * GITHUB_WORKSPACE missing — a local "simulation"), their fallbacks would
 * write into the caller's working directory while a spawned `dsh` inherits
 * the developer's real DSH_HOME. Both scripts must refuse to run in that
 * situation, and must succeed in a clean runner-shaped environment.
 * @module dsh-github/test/action-guard
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const patchScript = join(repoRoot, 'scripts', 'action-patch.mjs')
const postScript = join(repoRoot, 'scripts', 'action-post.mjs')

const sandboxes: string[] = []

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) rmSync(sandbox, { recursive: true, force: true })
})

/** A developer-shell environment: no GitHub Actions runner variables. */
function localEnv() {
  const env = { ...process.env }
  for (const name of [
    'RUNNER_TEMP', 'GITHUB_WORKSPACE', 'GITHUB_OUTPUT',
    'INPUT_OUTPUT_DIR', 'INPUT_TASK', 'INPUT_PR', 'INPUT_OWNER_REPO',
  ]) delete env[name]
  return env
}

function runScript(script: string, env: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    env,
    encoding: 'utf8',
    timeout: 60_000,
  })
}

describe('action-patch.mjs local guard', () => {
  it('refuses to run without RUNNER_TEMP and GITHUB_WORKSPACE', () => {
    const result = runScript(patchScript, localEnv())
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('refusing to run outside a GitHub Actions runner')
  })

  it('refuses to run when RUNNER_TEMP is set but GITHUB_WORKSPACE is missing', () => {
    const env = localEnv()
    env.RUNNER_TEMP = join(tmpdir(), 'dsh-github-guard-')
    const result = runScript(patchScript, env)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('refusing to run outside a GitHub Actions runner')
  })

  it('writes the overlay and task into INPUT_OUTPUT_DIR in a runner-shaped environment', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'dsh-github-guard-ok-'))
    sandboxes.push(sandbox)
    const outputDir = join(sandbox, 'output')
    const result = runScript(patchScript, {
      ...localEnv(),
      RUNNER_TEMP: sandbox,
      GITHUB_WORKSPACE: join(sandbox, 'workspace'),
      INPUT_OUTPUT_DIR: outputDir,
      INPUT_TASK: 'report',
      INPUT_OWNER_REPO: 'o/r',
    })
    expect(result.status).toBe(0)
    expect(readFileSync(join(outputDir, 'dsh-github-ci.cordis.yml'), 'utf8')).toContain('dsh-github CI overlay')
    expect(readFileSync(join(outputDir, 'task.txt'), 'utf8')).toContain('CI reporter')
  })
})

describe('action-post.mjs local guard', () => {
  it('refuses to run outside a runner before reading any result file', () => {
    const result = runScript(postScript, localEnv())
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('refusing to run outside a GitHub Actions runner')
  })
})
