// Local simulator for the composite action — explicitly isolated.
//
// The real action resolves every path from the runner environment:
//   DSH_HOME        = ${{ runner.temp }}/dsh-home
//   DSH_PROFILE_DIR = ${{ runner.temp }}/dsh-home/profiles/headless
//   output dir      = ${{ inputs.output-dir }} (default ${{ runner.temp }}/dsh-github)
// A naive local copy inherits the developer's real environment instead: a
// process-level (or machine-scope) DSH_HOME wins over everything, so the
// headless profile, sessions, storages, and reports would be written straight
// into the real dsh home — which is exactly what shuts local content down.
//
// This script therefore never reads DSH_HOME / DSH_PROFILE_DIR / RUNNER_TEMP
// from the inherited environment. Every spawned step receives hardcoded
// process-level values rooted in a fresh system-temp sandbox:
//   DSH_HOME        = <tmp>/dsh-github-local-<n>/dsh-home
//   DSH_PROFILE_DIR = <tmp>/dsh-github-local-<n>/dsh-home/profiles/headless
//   RUNNER_TEMP     = <tmp>/dsh-github-local-<n>
//   GITHUB_WORKSPACE = --workspace (default: this repository root)
//   INPUT_OUTPUT_DIR = <tmp>/dsh-github-local-<n>/output
//
// Steps replayed, mirroring action.yml: install → prepare (action-patch.mjs)
// → headless run → post (action-post.mjs). Nothing outside the sandbox is
// written. Run `node scripts/local-test.mjs --help` for the option list.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, delimiter, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))

const USAGE = `dsh-github local action simulator

Usage: node scripts/local-test.mjs [options]

Options:
  --task <review|fix-ci|report>   CI task to simulate (default: review)
  --pr <number>                   Pull request number (required for review/fix-ci)
  --owner-repo <owner/repo>       Repository to review (required for review/fix-ci)
  --task-prompt <text>            Complete replacement for the default task text
  --model <id>                    Model for the headless session (default: deepseek-v4-flash)
  --engine <static|model>         Review engine (default: static)
  --check-name <name>             Status-check name (default: dsh-github-review)
  --blocking <true|false>         Fail on needs-changes verdict (default: true)
  --fail-on <error|warning>       Lowest severity that flips the verdict (default: error)
  --label-filters <a,b>           Comma-separated label filters
  --path-filters <glob,glob>      Comma-separated path filters
  --max-diff-chars <n>            Diff character cap (default: 8000)
  --post-comments <true|false>    Post inline review comments (default: true)
  --post-check <true|false>       Publish the status check (default: true)
  --request-timeout-ms <n>        Per GitHub request timeout (default: 30000)
  --plugin-version <version|path> @perrylink/dsh-github version or local folder
                                  (default: latest)
  --workspace <dir>               GITHUB_WORKSPACE for the sandbox (default: repo root)
  --skip-install                  Skip the npm install of dsh-github into the profile
  --skip-run                      Only install + generate the overlay/task (no headless run)
  --clean                         Delete the temp sandbox when finished

Environment (passed through from your shell, never logged):
  DEEPSEEK_API_KEY                Required (the action's deepseek-api-key input)
  GITHUB_TOKEN | DSH_GITHUB_TOKEN Optional (the action's github-token input)

Isolation: DSH_HOME, DSH_PROFILE_DIR, RUNNER_TEMP, and the output directory are
hardcoded under the system temp directory for every spawned step, overriding any
inherited DSH_HOME (including machine-scope values). Your real dsh home is never
read or written.`

const args = process.argv.slice(2)
const options = {
  task: 'review',
  pr: '',
  ownerRepo: '',
  taskPrompt: '',
  model: 'deepseek-v4-flash',
  engine: 'static',
  checkName: 'dsh-github-review',
  blocking: 'true',
  failOn: 'error',
  labelFilters: '',
  pathFilters: '',
  maxDiffChars: '8000',
  postComments: 'true',
  postCheck: 'true',
  requestTimeoutMs: '30000',
  pluginVersion: 'latest',
  workspace: repoRoot,
  skipInstall: false,
  skipRun: false,
  clean: false,
}
const valueOf = { task: 1, pr: 1, 'owner-repo': 1, 'task-prompt': 1, model: 1, engine: 1, 'check-name': 1, blocking: 1, 'fail-on': 1, 'label-filters': 1, 'path-filters': 1, 'max-diff-chars': 1, 'post-comments': 1, 'post-check': 1, 'request-timeout-ms': 1, 'plugin-version': 1, workspace: 1 }
const keyOf = { task: 'task', pr: 'pr', 'owner-repo': 'ownerRepo', 'task-prompt': 'taskPrompt', model: 'model', engine: 'engine', 'check-name': 'checkName', blocking: 'blocking', 'fail-on': 'failOn', 'label-filters': 'labelFilters', 'path-filters': 'pathFilters', 'max-diff-chars': 'maxDiffChars', 'post-comments': 'postComments', 'post-check': 'postCheck', 'request-timeout-ms': 'requestTimeoutMs', 'plugin-version': 'pluginVersion', workspace: 'workspace' }
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--help' || arg === '-h') { console.log(USAGE); process.exit(0) }
  if (arg === '--skip-install') { options.skipInstall = true; continue }
  if (arg === '--skip-run') { options.skipRun = true; continue }
  if (arg === '--clean') { options.clean = true; continue }
  const eq = arg.indexOf('=')
  const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq)
  if (name in valueOf) {
    const inline = eq === -1 ? '' : arg.slice(eq + 1)
    const value = inline !== '' ? inline : args[++i] ?? ''
    options[keyOf[name]] = value
    continue
  }
  if (arg.startsWith('-')) {
    console.error(`dsh-github local-test: unknown option ${arg}`)
    console.error('Run `node scripts/local-test.mjs --help` for the option list.')
    process.exit(2)
  }
}

// Sandbox — hardcoded under the system temp directory, derived from nothing
// that the developer's environment could point at their real home.
const sandboxRoot = mkdtempSync(join(tmpdir(), 'dsh-github-local-'))
const dshHome = join(sandboxRoot, 'dsh-home')
const profileDir = join(dshHome, 'profiles', 'headless')
const outputDir = join(sandboxRoot, 'output')
const workspace = isAbsolute(options.workspace) ? options.workspace : resolve(options.workspace)

console.log('dsh-github local action simulator — isolated sandbox')
console.log(`  sandbox:        ${sandboxRoot}`)
console.log(`  DSH_HOME:       ${dshHome}`)
console.log(`  DSH_PROFILE_DIR:${profileDir}`)
console.log(`  output dir:     ${outputDir}`)
console.log(`  workspace:      ${workspace}`)
console.log('The real dsh home and any inherited DSH_HOME are never read or written.')

/** Run one shell command line, inheriting the caller's environment plus explicit overrides. */
function run(commandLine, { env = {}, allowFail = false, capture = false } = {}) {
  const result = spawnSync(commandLine, {
    shell: true,
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const status = typeof result.status === 'number' ? result.status : 1
  if (!allowFail && status !== 0) {
    console.error(`dsh-github local-test: command failed (exit ${status}): ${commandLine}`)
    process.exit(status)
  }
  return { status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/** Locate an executable (with a .cmd/.exe/.bat shim on Windows) on PATH. */
function findOnPath(name) {
  const entries = (process.env.PATH ?? '').split(delimiter)
  const extensions = process.platform === 'win32' ? ['cmd', 'exe', 'bat', ''] : ['']
  for (const entry of entries) {
    for (const extension of extensions) {
      const candidate = join(entry, extension === '' ? name : `${name}.${extension}`)
      if (candidate !== name && existsSync(candidate)) return candidate
    }
  }
  return ''
}
const q = (value) => JSON.stringify(value)

// ---- Step 1: install the profile (action.yml "Install dsh and dsh-github") ----
mkdirSync(profileDir, { recursive: true })
writeFileSync(join(profileDir, 'package.json'), '{"private": true}\n')
const installEnv = { DSH_HOME: dshHome, DSH_PROFILE_DIR: profileDir }
if (options.skipInstall) {
  console.log('skipping npm install (--skip-install): the overlay row @perrylink/dsh-github must resolve from the profile node_modules')
} else {
  console.log(`installing @perrylink/dsh-github@${options.pluginVersion} into the sandboxed profile …`)
  const target = existsSync(options.pluginVersion) || options.pluginVersion.includes('/') || options.pluginVersion.includes('\\')
    ? resolve(options.pluginVersion)
    : `@perrylink/dsh-github@${options.pluginVersion}`
  run(`npm install --prefix ${q(profileDir)} --legacy-peer-deps --package-lock=false --no-save --no-audit --no-fund ${q(target)}`, { env: installEnv })
}

// ---- Step 2: prepare (action.yml "Generate the dsh profile overlay and task") ----
mkdirSync(outputDir, { recursive: true })
const inputs = {
  INPUT_TASK: options.task,
  INPUT_PR: options.pr,
  INPUT_OWNER_REPO: options.ownerRepo,
  INPUT_MODEL: options.model,
  INPUT_ENGINE: options.engine,
  INPUT_CHECK_NAME: options.checkName,
  INPUT_BLOCKING: options.blocking,
  INPUT_FAIL_ON: options.failOn,
  INPUT_LABEL_FILTERS: options.labelFilters,
  INPUT_PATH_FILTERS: options.pathFilters,
  INPUT_MAX_DIFF_CHARS: options.maxDiffChars,
  INPUT_POST_COMMENTS: options.postComments,
  INPUT_POST_CHECK: options.postCheck,
  INPUT_REQUEST_TIMEOUT_MS: options.requestTimeoutMs,
  INPUT_TASK_PROMPT: options.taskPrompt,
  INPUT_OUTPUT_DIR: outputDir,
}
run(`node ${q(join(repoRoot, 'scripts', 'action-patch.mjs'))}`, {
  env: { RUNNER_TEMP: sandboxRoot, GITHUB_WORKSPACE: workspace, ...inputs },
})
console.log(`overlay and task written: ${join(outputDir, 'dsh-github-ci.cordis.yml')}`)

if (options.skipRun) {
  console.log('stopping after prepare (--skip-run); the sandbox is kept for inspection.')
  console.log(`sandbox: ${sandboxRoot}`)
  process.exit(0)
}

// ---- Step 3: headless run (action.yml "Run dsh headless") ----
if ((process.env.DEEPSEEK_API_KEY ?? '').trim() === '') {
  console.error('dsh-github local-test: DEEPSEEK_API_KEY is required (the action\'s deepseek-api-key input). Set it in your shell, not in the profile.')
  console.error(`sandbox kept for inspection: ${sandboxRoot}`)
  process.exit(2)
}
if (findOnPath('dsh') === '') {
  console.error('dsh-github local-test: the dsh CLI was not found on PATH. Install it first: npm install --global @deepseek-ai/dsh')
  console.error(`sandbox kept for inspection: ${sandboxRoot}`)
  process.exit(2)
}
const githubToken = process.env.DSH_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? ''
if (githubToken === '' && options.postComments === 'true') {
  console.log('note: no DSH_GITHUB_TOKEN / GITHUB_TOKEN in the environment — posting comments and the status check will fail per operation (static dry inspections still work).')
}
const taskText = readFileSync(join(outputDir, 'task.txt'), 'utf8')
const overlayPath = join(outputDir, 'dsh-github-ci.cordis.yml')
const runEnv = {
  DSH_HOME: dshHome,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  DSH_GITHUB_CI_DRIVER: '1',
  DSH_GITHUB_CI_OUTPUT_DIR: outputDir,
  DSH_TELEMETRY_DISABLED: '1',
}
if (githubToken !== '') runEnv.DSH_GITHUB_TOKEN = githubToken
console.log('running dsh headless in the sandboxed home …')
const headless = run(`dsh --profile headless --patch ${q(overlayPath)} ${q(taskText)}`, { env: runEnv, allowFail: true, capture: true })
writeFileSync(join(outputDir, 'dsh-github-stdout.log'), headless.stdout)
writeFileSync(join(outputDir, 'dsh-github-stderr.log'), headless.stderr)
writeFileSync(join(outputDir, 'dsh-github-exit.txt'), `${headless.status}\n`)
console.log(headless.stdout)
if (headless.stderr.trim() !== '') console.log(headless.stderr)

// ---- Step 4: post (action.yml "Publish outputs and enforce the gate") ----
const post = run(`node ${q(join(repoRoot, 'scripts', 'action-post.mjs'))}`, {
  env: {
    RUNNER_TEMP: sandboxRoot,
    GITHUB_WORKSPACE: workspace,
    INPUT_OUTPUT_DIR: outputDir,
    INPUT_BLOCKING: options.blocking,
    GITHUB_OUTPUT: join(outputDir, 'github-output.env'),
  },
  allowFail: true,
})
console.log(`\nsandbox kept at: ${sandboxRoot}`)
console.log(`  result: ${join(outputDir, 'dsh-github-ci-result.json')}`)
console.log(`  summary: ${join(outputDir, 'dsh-github-ci-summary.md')}`)
console.log(`  logs: ${join(outputDir, 'dsh-github-stdout.log')} / dsh-github-stderr.log`)
if (options.clean) {
  rmSync(sandboxRoot, { recursive: true, force: true })
  console.log('sandbox removed (--clean).')
}
process.exit(post.status)
