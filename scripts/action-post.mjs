// Post-process the CI run for the composite action: publish the step outputs
// from dsh-github-ci-result.json and enforce the blocking gate.
//
// Exit codes:
//   0 — report exists and the gate passed (or the verdict is non-blocking).
//   1 — report missing (the headless run never produced one), or
//       blocking=true and the verdict is "needs-changes".
// The status check itself (published by the pipeline) is what gates branch
// protection; this exit code fails the CI job for blocking=false-style
// workflow-level enforcement and for downstream status reporting.
import { readFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

// Local-machine protection: the post step reads the CI result from the output
// directory and publishes step outputs through GITHUB_OUTPUT, both of which
// only exist on a GitHub Actions runner. Outside a runner the fallback would
// read an arbitrary `./dsh-github` directory next to the caller's cwd and
// report phantom verdicts. Refuse to run instead of guessing.
const runnerTemp = (process.env.RUNNER_TEMP ?? '').trim()
const workspace = (process.env.GITHUB_WORKSPACE ?? '').trim()
if (runnerTemp === '' || workspace === '') {
  console.error('dsh-github: refusing to run outside a GitHub Actions runner — both RUNNER_TEMP and GITHUB_WORKSPACE must be set.')
  console.error('dsh-github: to exercise the action locally, use `node scripts/local-test.mjs`; it pins DSH_HOME, DSH_PROFILE_DIR, and the output directory under the system temp directory.')
  process.exit(1)
}

const outputDir = process.env.INPUT_OUTPUT_DIR?.trim() || join(process.env.RUNNER_TEMP ?? '.', 'dsh-github')
const resultPath = join(outputDir, 'dsh-github-ci-result.json')
const blocking = (process.env.INPUT_BLOCKING ?? 'true').trim() === 'true'
const outputFile = process.env.GITHUB_OUTPUT ?? ''

let result
try {
  result = JSON.parse(readFileSync(resultPath, 'utf8'))
} catch (error) {
  console.error(`dsh-github: no CI result at ${resultPath} — the headless run did not produce a review (${error instanceof Error ? error.message : String(error)}). Check the dsh stderr log next to it.`)
  if (outputFile !== '') appendFileSync(outputFile, 'verdict=error\n')
  process.exit(1)
}

const markdownPath = join(outputDir, 'dsh-github-ci-summary.md')
const verdict = typeof result.verdict === 'string' ? result.verdict : 'error'
if (outputFile !== '') {
  appendFileSync(outputFile,
    `verdict=${verdict}\n`
    + `report-json=${resultPath}\n`
    + `report-markdown=${markdownPath}\n`
    + `${result.checkRun?.url !== undefined ? `check-url=${result.checkRun.url}\n` : ''}`)
}

console.log(`dsh-github: verdict ${verdict} — PR #${result.pr} in ${result.repo}${result.alreadyReviewed ? ' (already reviewed at this head commit)' : ''}`)
console.log(`dsh-github: ${result.summary}`)

if (blocking && verdict === 'needs-changes') {
  console.error(`dsh-github: blocking gate failed — the review verdict is "needs-changes". See ${markdownPath}`)
  process.exit(1)
}
if (verdict === 'error') {
  console.error('dsh-github: the pipeline reported an error verdict')
  process.exit(1)
}
