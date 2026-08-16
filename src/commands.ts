/**
 * Human slash commands: /pr, /review, /issue.
 *
 * Commands never perform GitHub writes themselves: command handlers run with
 * no open turn, so the approval seam is structurally closed to them. Instead
 * a write command gathers read-only context (git state, review records) and
 * queues a model instruction — via followup for an idle agent, inject for a
 * busy one — so the model calls the corresponding write tool inside a turn,
 * where the tools/pre-execute approval gate asks the human. Read-only command
 * work (starting or stopping a review job) runs directly in the handler.
 * @module dsh-github/commands
 */
import { createUserMessage } from '@deepseek-ai/dsh-llm/message'
import { readGitState } from './git.ts'
import { startReviewJob } from './jobs.ts'
import type { CommandDefinition, CommandInvocation, CommandResult, CommandsService, GithubAgent, JobRegistry } from './types.ts'
import type { GithubState } from './state.ts'

const USAGE_PR = 'Usage: /pr create [title]'
const USAGE_REVIEW = 'Usage: /review <pr> [--max-diff <n>] [--no-ci] [--no-comments] | /review stop <jobId> | /review post <jobId>'
const USAGE_ISSUE = 'Usage: /issue open <title>'

/** Queue a model instruction: wake an idle driver, inject into a busy one. */
function notify(agent: GithubAgent, text: string): void {
  const summary = text.split('\n')[0] ?? ''
  const message = createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: 'dsh-github', form: 'notice', summary },
  })
  if (agent.status === 'idle') agent.followup(message)
  else agent.inject(message)
}

/** Register the /pr command family. */
export function registerPrCommand(commands: CommandsService, state: GithubState): () => void {
  return commands.register({
    name: 'pr',
    description: 'Create a GitHub pull request (approval required)',
    input: { hint: 'create [title]' },
    handler: async (invocation): Promise<CommandResult> => {
      const [sub, ...rest] = invocation.rawInput.trim().split(/\s+/)
      if (sub === undefined || sub.length === 0) return { kind: 'success', text: USAGE_PR }
      if (sub !== 'create') return { kind: 'error', text: `unknown /pr subcommand "${sub}". ${USAGE_PR}` }
      return createPrDraft(invocation, rest.join(' '), state)
    },
  })
}

/** Gather git state and queue a pr_create instruction for the model. */
async function createPrDraft(invocation: CommandInvocation, title: string, state: GithubState): Promise<CommandResult> {
  const git = await readGitState(state.workspaceDir, state.runGit, invocation.signal, state.apiHost)
  if (git.error !== undefined) {
    return { kind: 'error', text: `could not read git state: ${git.error}. Run /pr create inside a git checkout.` }
  }
  if (git.branch === null) return { kind: 'error', text: 'no current branch found. Run /pr create inside a git checkout.' }
  const repo = git.repoFromRemote ?? state.config.defaultOwnerRepo
  if (repo === undefined) {
    return { kind: 'error', text: 'could not determine the target repository. Set defaultOwnerRepo in cordis.yml or add a GitHub origin remote.' }
  }

  const lines = [
    `The user ran /pr create${title.length > 0 ? ` "${title}"` : ''}. Create a GitHub pull request by calling the pr_create tool.`,
    `- ownerRepo: ${repo}`,
    `- head: ${git.branch}`,
    '- base: omit (repository default branch)',
    `- title: ${title.length > 0 ? JSON.stringify(title) : 'derive one from the changes'}`,
  ]
  if (git.hasChanges) {
    lines.push(`- the working tree has uncommitted changes: ${git.changedFiles.slice(0, 10).join(', ')}${git.changedFiles.length > 10 ? ' …' : ''}`)
  }
  if (git.commitsAhead.length > 0) {
    lines.push(`- unpushed commits ahead of upstream:\n${git.commitsAhead.slice(0, 20).join('\n')}`)
  }
  lines.push(state.config.autoCommit
    ? '- autoCommit is enabled: commit the uncommitted changes and push them to the remote via bash first (each bash write needs approval), then call pr_create.'
    : '- do NOT commit or push anything; create the PR against the pushed head as-is.')
  lines.push('You may polish the PR body before calling pr_create. Creating the PR asks the human for approval.')

  notify(invocation.agent, lines.join('\n'))
  return { kind: 'success', text: `queued a pr_create draft for ${repo} (${git.branch}). The model prepares the PR; creation requires your approval.` }
}

/** Register the /review command family. */
export function registerReviewCommand(commands: CommandsService, jobs: JobRegistry, state: GithubState): () => void {
  return commands.register({
    name: 'review',
    description: 'Review a GitHub pull request in a background job',
    input: { hint: '<pr> [--max-diff <n>] [--no-ci] [--no-comments] | stop <jobId> | post <jobId>' },
    handler: async (invocation): Promise<CommandResult> => {
      const input = invocation.rawInput.trim()
      if (input.length === 0) return { kind: 'success', text: USAGE_REVIEW }
      if (input.startsWith('stop ')) {
        const jobId = input.slice('stop '.length).trim()
        if (jobId.length === 0) return { kind: 'error', text: USAGE_REVIEW }
        if (!state.records.has(jobId)) {
          return { kind: 'error', text: `no review job "${jobId}". List jobs with job_list or check the /review output.` }
        }
        const outcome = jobs.kill(jobId, invocation.agent, 'user requested stop via /review stop')
        return { kind: 'success', text: outcome === 'requested' ? `requested stop of job ${jobId}` : `job ${jobId} had already finished` }
      }
      if (input.startsWith('post ')) {
        const jobId = input.slice('post '.length).trim()
        if (jobId.length === 0) return { kind: 'error', text: USAGE_REVIEW }
        const record = state.records.get(jobId)
        if (record === undefined) {
          return { kind: 'error', text: `no review job "${jobId}". List jobs with job_list or check the /review output.` }
        }
        if (record.status !== 'completed' || record.report === null) {
          return { kind: 'error', text: `review job "${jobId}" is ${record.status}; wait for completion before posting.` }
        }
        const reportSummary = record.report.findings.length === 0 && record.report.summary.startsWith('model review')
          ? 'model review'
          : `${record.report.findings.length} finding(s)`
        notify(invocation.agent,
          `The user ran /review post ${jobId}. Call the review_post tool with { "jobId": "${jobId}" } to publish the review `
          + `for PR #${record.pr} in ${record.repo} (${reportSummary}). Use mode "inline" for line-anchored `
          + 'comments or "summary" for one aggregated comment. Posting asks the human for approval.')
        return { kind: 'success', text: `queued review_post for job ${jobId} (PR #${record.pr}, ${reportSummary}). Posting requires your approval.` }
      }
      return startReview(invocation, input, jobs, state)
    },
  })
}

/** Parse `/review <pr>` options: --max-diff <n>, --no-ci, --no-comments. */
function parseReviewOptions(input: string): { pr: string; options: { maxDiffChars?: number; includeCi: boolean; includeComments: boolean } } {
  const parts = input.split(/\s+/)
  const options: { maxDiffChars?: number; includeCi: boolean; includeComments: boolean } = { includeCi: true, includeComments: true }
  let pr = ''
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? ''
    if (part === '--max-diff') {
      const value = parts[index + 1]
      if (value === undefined || !/^\d+$/.test(value)) throw new Error(`--max-diff needs a positive number. ${USAGE_REVIEW}`)
      options.maxDiffChars = Number(value)
      index += 1
      continue
    }
    if (part === '--no-ci') { options.includeCi = false; continue }
    if (part === '--no-comments') { options.includeComments = false; continue }
    if (pr.length > 0) throw new Error(`unexpected argument "${part}". ${USAGE_REVIEW}`)
    pr = part
  }
  if (pr.length === 0) throw new Error(USAGE_REVIEW)
  return { pr, options }
}

/** Start a background review job for one PR reference. */
async function startReview(invocation: CommandInvocation, input: string, jobs: JobRegistry, state: GithubState): Promise<CommandResult> {
  let parsed: { pr: string; options: { maxDiffChars?: number; includeCi: boolean; includeComments: boolean } }
  try {
    parsed = parseReviewOptions(input)
  } catch (error) {
    return { kind: 'error', text: error instanceof Error ? error.message : USAGE_REVIEW }
  }
  const ref = state.parsePrRef(parsed.pr)
  if (ref === null) {
    return { kind: 'error', text: `"${parsed.pr}" is not a PR reference. Use a number, "#number", "owner/repo#number", or a pull URL.` }
  }
  const repoResult = ref.repo !== undefined ? { ok: true as const, repo: ref.repo } : await state.resolveRepo(undefined, invocation.signal)
  if (!repoResult.ok) return { kind: 'error', text: `${repoResult.message}. ${repoResult.guidance}` }

  let jobId: string
  try {
    jobId = startReviewJob(jobs, state, {
      repo: repoResult.repo,
      pr: ref.number,
      label: `review PR #${ref.number} (${repoResult.repo})`,
      owner: invocation.agent,
      ...parsed.options,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      kind: 'error',
      text: `could not start the review job: ${detail}.\n`
        + 'Load @deepseek-ai/dsh-tool-jobs in the agent composition (it serves the job registry and owns completion notices), then retry.',
    }
  }
  return {
    kind: 'success',
    text: `started review job ${jobId} for PR #${ref.number} in ${repoResult.repo}.\n`
      + `You will be notified on completion; the model reads it via job_output ${jobId}.\n`
      + `/review post ${jobId} publishes the comment (requires your approval) · /review stop ${jobId} cancels.`,
  }
}

/** Register the /issue command family. */
export function registerIssueCommand(commands: CommandsService, state: GithubState): () => void {
  return commands.register({
    name: 'issue',
    description: 'Open a GitHub issue (approval required)',
    input: { hint: 'open <title>' },
    handler: async (invocation): Promise<CommandResult> => {
      const input = invocation.rawInput.trim()
      if (input.length === 0) return { kind: 'success', text: USAGE_ISSUE }
      if (!input.startsWith('open ')) return { kind: 'error', text: `unknown /issue subcommand. ${USAGE_ISSUE}` }
      const title = input.slice('open '.length).trim()
      if (title.length === 0) return { kind: 'error', text: USAGE_ISSUE }
      const repoResult = await state.resolveRepo(undefined, invocation.signal)
      if (!repoResult.ok) return { kind: 'error', text: `${repoResult.message}. ${repoResult.guidance}` }
      notify(invocation.agent,
        `The user ran /issue open "${title}". Create the issue by calling the issue_open tool with `
        + `{ "title": ${JSON.stringify(title)}, "ownerRepo": "${repoResult.repo}" } and a concise body you write. `
        + 'Creating the issue asks the human for approval.')
      return { kind: 'success', text: `queued issue_open for ${repoResult.repo}. Creating the issue requires your approval.` }
    },
  })
}

/** Register all three command families; returns the combined disposer. */
export function registerCommands(commands: CommandsService, jobs: JobRegistry, state: GithubState): () => void {
  const disposers = [
    registerPrCommand(commands, state),
    registerReviewCommand(commands, jobs, state),
    registerIssueCommand(commands, state),
  ]
  return () => {
    for (const dispose of disposers) dispose()
  }
}

export type { CommandDefinition }
