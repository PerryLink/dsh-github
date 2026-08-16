// Generates the dsh headless profile overlay and the task text for the
// composite action. Zero-dependency Node: every input arrives through the
// runner's INPUT_* environment variables (composite-action inputs), and every
// value is emitted as a JSON string (a valid YAML scalar) so arbitrary user
// input can never break the YAML structure.
//
// Writes to $INPUT_OUTPUT_DIR:
//   dsh-github-ci.cordis.yml — the --patch overlay (Minimal persona + role
//     line, model selection, sandbox, the minimal bash/editor toolset, and
//     the dsh-github row with the full ci.* configuration).
//   task.txt — the headless task for the selected mode.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Local-machine protection: the composite action resolves every path from the
// runner environment (RUNNER_TEMP for the output directory, GITHUB_WORKSPACE
// for the sandbox root). Outside a GitHub Actions runner those variables do
// not exist, and every fallback would silently write the profile overlay and
// task into the current working directory while a locally spawned `dsh`
// inherits the developer's real DSH_HOME. Refuse to run instead of guessing.
const runnerTemp = (process.env.RUNNER_TEMP ?? '').trim()
const workspace = (process.env.GITHUB_WORKSPACE ?? '').trim()
if (runnerTemp === '' || workspace === '') {
  console.error('dsh-github: refusing to run outside a GitHub Actions runner — both RUNNER_TEMP and GITHUB_WORKSPACE must be set.')
  console.error('dsh-github: to exercise the action locally, use `node scripts/local-test.mjs`; it pins DSH_HOME, DSH_PROFILE_DIR, and the output directory under the system temp directory.')
  process.exit(1)
}

const env = (name) => process.env[name] ?? ''
const boolOf = (value, fallback) => value.trim() === '' ? fallback : value.trim() === 'true' || value.trim() === '1'
const listOf = (value) => value.split(',').map(item => item.trim()).filter(item => item.length > 0)
const y = (value) => JSON.stringify(value)

const task = env('INPUT_TASK').trim() || 'review'
const pr = env('INPUT_PR').trim()
const ownerRepo = env('INPUT_OWNER_REPO').trim()
const model = env('INPUT_MODEL').trim() || 'deepseek-v4-flash'
const engine = env('INPUT_ENGINE').trim() === 'model' ? 'model' : 'static'
const checkName = env('INPUT_CHECK_NAME').trim() || 'dsh-github-review'
const blocking = boolOf(env('INPUT_BLOCKING'), true)
const failOn = env('INPUT_FAIL_ON').trim() === 'warning' ? 'warning' : 'error'
const labelFilters = listOf(env('INPUT_LABEL_FILTERS'))
const pathFilters = listOf(env('INPUT_PATH_FILTERS'))
const maxDiffChars = Number(env('INPUT_MAX_DIFF_CHARS')) > 0 ? Math.floor(Number(env('INPUT_MAX_DIFF_CHARS'))) : 8000
const postComments = boolOf(env('INPUT_POST_COMMENTS'), true)
const postCheck = boolOf(env('INPUT_POST_CHECK'), true)
const requestTimeoutMs = Number(env('INPUT_REQUEST_TIMEOUT_MS')) > 0 ? Math.floor(Number(env('INPUT_REQUEST_TIMEOUT_MS'))) : 30000
const outputDir = env('INPUT_OUTPUT_DIR').trim() || join(process.env.RUNNER_TEMP ?? '.', 'dsh-github')
const customTask = env('INPUT_TASK_PROMPT').trim()

if ((task === 'review' || task === 'fix-ci') && pr === '') {
  console.error('dsh-github: the `pr` input is required for the review and fix-ci tasks (defaults to github.event.pull_request.number on pull_request events)')
  process.exit(1)
}
if (ownerRepo === '') {
  console.error('dsh-github: the `owner-repo` input is required (defaults to github.repository)')
  process.exit(1)
}

mkdirSync(outputDir, { recursive: true })

const callJson = (extra) => JSON.stringify({ task: extra.task, pr, ownerRepo, ...extra })

let taskText
if (customTask !== '') {
  taskText = customTask
} else if (task === 'review' && engine === 'static') {
  taskText = `You are the dsh-github CI reviewer for this repository. Call the ci_run tool once with ${callJson({ task: 'review' })} and then reply with only the verdict and the summary line from its result.`
} else if (task === 'review') {
  taskText = `You are a careful software engineer reviewing a GitHub pull request. First call ci_run with ${callJson({ task: 'analyze' })}. Review the diff yourself: correctness, security, style, and maintainability. Then call ci_run with ${callJson({ task: 'publish' })} plus a "body" holding your review (Markdown, verdict first, findings grouped by file) and a "findings" array for line-anchored problems you found. Finish by replying with only the verdict and the summary line from the publish result.`
} else if (task === 'fix-ci') {
  taskText = `You are the dsh-github CI engineer for this repository. Investigate the CI failures of PR #${pr} in ${ownerRepo}: read the failing checks with gh_review (fields "ci"), inspect the code with gh_file and gh_repo, and use the bash tool only to read logs or run read-only diagnostics. Do NOT modify files. Write a fix plan as your final answer and call ci_run with ${callJson({ task: 'publish' })} plus a "body" holding that plan so it is posted as a review comment.`
} else {
  taskText = `You are the dsh-github CI reporter for this repository. Generate a concise, factual report about ${ownerRepo}${pr !== '' ? ` PR #${pr}` : ''} using the read tools (gh_repo, gh_file, gh_review, gh_search). Write the report as your final answer and, if a pull request is being analyzed, call ci_run with ${callJson({ task: 'publish' })} plus a "body" holding the report so it is posted as a review comment.`
}

const personaText = 'You are a helpful software engineer assistant.\nYou are the dsh-github CI assistant for this repository.'

const overlay = `# dsh-github CI overlay — generated by the composite action; every value is
# emitted by scripts/action-patch.mjs from the action inputs. Do not edit.
# Rows that already exist in dsh-base are replaced by id; new rows ride an
# insert block (non-insert patches only replace existing rows).
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    text: ${y(personaText)}
    complete: true
    includeRuntimeContext: false

- id: agent-default-model
  name: '@deepseek-ai/dsh-agent-default-model'
  config:
    provider: deepseek-official
    model: ${y(model)}

- id: llm-deepseek
  name: '@deepseek-ai/dsh-llm-deepseek'
  config:
    apiKeyEnv: DEEPSEEK_API_KEY

- id: sandbox-policy
  name: '@deepseek-ai/dsh-sandbox-policy'
  config:
    mode: workspace-write
    workspaceRoot: !!js process.env.GITHUB_WORKSPACE ?? process.cwd()

# The minimal toolset (persistent bash + editor), matching the official
# minimal preset: enough to investigate CI failures and generate reports,
# bounded by the workspace-write sandbox above.
- insert:
    - id: terminal
      name: '@deepseek-ai/dsh-terminal'

    - id: terminal-bash
      name: '@deepseek-ai/dsh-terminal-bash'
      config:
        timeoutMs: 300000

    - id: persistent-bash
      name: '@deepseek-ai/dsh-tool-bash-persistent'
      config:
        timeoutMs: 300000

    - id: str-replace-editor
      name: '@deepseek-ai/dsh-tool-str-replace-editor'
      config:
        maxOutputChars: 16000

    - id: dsh-github
      name: '@perrylink/dsh-github'
      config:
        tokenSource: env
        tokenRef: DSH_GITHUB_TOKEN
        maxDiffChars: ${maxDiffChars}
        requestTimeoutMs: ${requestTimeoutMs}
        ci:
          enabled: true
          engine: ${y(engine)}
          autoApprove: ['ci.run']
          checkName: ${y(checkName)}
          blocking: ${blocking}
          failOn: ${y(failOn)}
          pollIntervalMs: 0
          labelFilters: ${y(labelFilters)}
          pathFilters: ${y(pathFilters)}
          postComments: ${postComments}
          reportDir: ${y(outputDir)}
`

writeFileSync(join(outputDir, 'dsh-github-ci.cordis.yml'), overlay)
writeFileSync(join(outputDir, 'task.txt'), taskText + '\n')
console.log(`dsh-github: overlay and task written to ${outputDir} (task: ${task}, engine: ${engine})`)
