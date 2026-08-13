/**
 * The model-facing tool surface of dsh-github.
 *
 * Five tools: pr_create / review_post / issue_open (writes, approval-gated by
 * the tools/pre-execute listener in approval-gate.ts) and gh_review / gh_issue
 * (concurrency-safe reads). Every execute returns only the canonical JSON
 * value declared by its output schema; infrastructure failures throw so the
 * registry marks them isError. Tokens never appear in canonical values,
 * rendered content, or thrown messages.
 * @module dsh-github/tools
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { GithubError } from './github.ts'
import { readGitState } from './git.ts'
import { analyzeDiff, parseDiffStats, type Finding } from './review.ts'
import { rateLimitValue, type GithubState } from './state.ts'
import {
  ghIssueCall, ghIssueResult, ghReviewCall, ghReviewResult,
  identityMeta, issueOpenCall, issueOpenResult, prCreateCall, prCreateResult,
  reviewPostCall, reviewPostResult,
  type GithubErrorValue, type IssueListValue, type PrSummaryValue,
} from './present.ts'

const ERROR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', required: true, const: 'error' },
    code: { type: 'string', required: true },
    message: { type: 'string', required: true },
    guidance: { type: 'string' },
  },
} as const

const RATE_LIMIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    remaining: { oneOf: [{ type: 'number' }, { type: 'null' }] },
    resetAt: { oneOf: [{ type: 'number' }, { type: 'null' }] },
  },
  required: true,
} as const

/** Domain error canonical value, used by every tool. */
export function errorValue(code: string, message: string, guidance?: string): GithubErrorValue {
  return { status: 'error', code, message, ...guidance !== undefined ? { guidance } : {} }
}

/** Convert a GitHub API failure to the error variant; rethrow the rest. */
function githubErrorValue(error: unknown): GithubErrorValue {
  if (error instanceof GithubError) {
    return errorValue('github-api', `GitHub API ${error.status}: ${error.message}`)
  }
  throw error
}

/** Cap text to `maxChars` characters and report the truncation. */
function capText(text: string, maxChars: number): { text: string; truncated: boolean } {
  return text.length > maxChars ? { text: text.slice(0, maxChars), truncated: true } : { text, truncated: false }
}

/** Fields gh_review can select; omitted means all. */
const REVIEW_FIELDS = ['metadata', 'diff', 'comments', 'ci', 'findings'] as const

interface PullPayload {
  number: number
  title: string
  state: string
  html_url: string
  additions: number
  deletions: number
  draft?: boolean
  user?: { login?: string } | null
  head?: { ref?: string; sha?: string } | null
  base?: { ref?: string } | null
}

interface CommentPayload {
  id: number
  body?: string
  path?: string | null
  line?: number | null
  user?: { login?: string } | null
}

interface CheckRunsPayload {
  total_count?: number
  check_runs?: Array<{ name?: string; status?: string; conclusion?: string | null }>
}

interface IssuePayload {
  number: number
  title: string
  state: string
  html_url: string
  comments?: number
  created_at?: string
  body?: string | null
  user?: { login?: string } | null
}

/** `pr_create`: create a pull request (write; approval-gated upstream). */
export function prCreateTool(state: GithubState) {
  return defineTool({
    name: 'pr_create',
    description: 'Create a GitHub pull request. Requires approval. Does NOT commit or push local changes — '
      + 'commit and push via bash first when the head branch is not on the remote. Returns the PR URL and number.',
    parameters: {
      title: { type: 'string', required: true, description: 'PR title.' },
      body: { type: 'string', description: 'PR description body.' },
      base: { type: 'string', description: 'Target branch. Defaults to the repository default branch.' },
      head: { type: 'string', description: 'Source branch. Defaults to the current git branch.' },
      draft: { type: 'boolean', description: 'Create as a draft PR.' },
      ownerRepo: { type: 'string', description: 'Target repository as owner/repo. Defaults to configured or git origin.' },
    },
    output: {
      schema: {
        oneOf: [{
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', required: true, const: 'created' },
            url: { type: 'string', required: true },
            number: { type: 'integer', required: true },
            title: { type: 'string', required: true },
            state: { type: 'string', required: true },
            draft: { type: 'boolean', required: true },
            base: { type: 'string', required: true },
            head: { type: 'string', required: true },
          },
        }, ERROR_SCHEMA],
      },
      render: (_args, value) => {
        if (value.status === 'error') {
          return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }]
        }
        return [{ type: 'text', text: `created pull request #${value.number}: ${value.url} (${value.base} ← ${value.head}${value.draft ? ', draft' : ''})` }]
      },
      presentationMeta: identityMeta,
    },
    isConcurrencySafe: () => false,
    presentCall: prCreateCall,
    presentResult: prCreateResult,
    async execute(args, exec) {
      if (args.title.trim().length === 0) return errorValue('invalid-args', 'title must not be empty')
      const repo = await state.resolveRepo(args.ownerRepo, exec.signal)
      if (!repo.ok) return errorValue(repo.code, repo.message, repo.guidance)

      let head = args.head?.trim()
      if (head === undefined || head.length === 0) {
        const git = await readGitState(state.workspaceDir, state.runGit, exec.signal)
        if (git.branch === null) return errorValue('no-head', 'could not determine the head branch', 'Pass `head` explicitly or run inside a git checkout.')
        head = git.branch
      }

      const token = await state.resolveToken(exec.signal)
      if (!token.ok) return errorValue(token.error.code, token.error.message, token.error.guidance)
      const client = state.client(token.token.value)

      let base = args.base?.trim()
      if (base === undefined || base.length === 0) {
        try {
          const repoInfo = await client.requestJson<{ default_branch?: string }>('GET', `/repos/${repo.repo}`, { signal: exec.signal })
          base = repoInfo.data.default_branch
          if (base === undefined || base.length === 0) return errorValue('no-base', 'the repository reports no default branch', 'Pass `base` explicitly.')
        } catch (error) {
          return githubErrorValue(error)
        }
      }

      try {
        const created = await client.requestJson<PullPayload>('POST', `/repos/${repo.repo}/pulls`, {
          signal: exec.signal,
          body: {
            title: args.title,
            ...args.body !== undefined ? { body: args.body } : {},
            head,
            base,
            draft: args.draft === true,
          },
        })
        const data = created.data
        return {
          status: 'created',
          url: data.html_url,
          number: data.number,
          title: data.title,
          state: data.state,
          draft: data.draft === true,
          base: data.base?.ref ?? base,
          head: data.head?.ref ?? head,
        } as const
      } catch (error) {
        return githubErrorValue(error)
      }
    },
  })
}

/** `gh_review`: read a PR's metadata, diff, comments, CI, and findings. */
export function ghReviewTool(state: GithubState) {
  return defineTool({
    name: 'gh_review',
    description: 'Read a GitHub pull request: metadata, unified diff, review comments, CI check status, and '
      + 'static-analysis findings. Read-only and concurrency-safe. `pr` accepts a number, "#number", '
      + '"owner/repo#number", or a pull-request URL.',
    parameters: {
      pr: { type: 'string', required: true, description: 'PR number, #number, owner/repo#number, or pull URL.' },
      fields: { type: 'array', items: { type: 'string', enum: [...REVIEW_FIELDS] }, description: 'Sections to fetch. Omit for all.' },
      maxDiffChars: { type: 'number', description: 'Cap for the diff text. Defaults to the plugin config.' },
    },
    output: {
      schema: {
        oneOf: [{
          type: 'object',
          additionalProperties: false,
          properties: {
            repo: { type: 'string', required: true },
            number: { type: 'integer', required: true },
            title: { type: 'string', required: true },
            state: { type: 'string', required: true },
            author: { type: 'string', required: true },
            url: { type: 'string', required: true },
            additions: { type: 'integer', required: true },
            deletions: { type: 'integer', required: true },
            base: { type: 'string', required: true },
            head: { type: 'string', required: true },
            ci: {
              type: 'object',
              additionalProperties: false,
              required: true,
              properties: {
                summary: { type: 'string', required: true },
                status: { type: 'string' },
                conclusion: { type: 'string' },
                runs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      name: { type: 'string', required: true },
                      status: { type: 'string', required: true },
                      conclusion: { type: 'string' },
                    },
                  },
                },
              },
            },
            comments: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'integer', required: true },
                  user: { type: 'string', required: true },
                  path: { type: 'string' },
                  line: { type: 'integer' },
                  body: { type: 'string', required: true },
                },
              },
            },
            findings: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  file: { type: 'string', required: true },
                  line: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
                  severity: { type: 'string', required: true, enum: ['info', 'warning', 'error'] },
                  rule: { type: 'string', required: true },
                  message: { type: 'string', required: true },
                },
              },
            },
            diff: {
              type: 'object',
              additionalProperties: false,
              required: true,
              properties: {
                length: { type: 'integer', required: true },
                truncated: { type: 'boolean', required: true },
                excerpt: { type: 'string', required: true },
                files: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      path: { type: 'string', required: true },
                      added: { type: 'integer', required: true },
                      removed: { type: 'integer', required: true },
                    },
                  },
                },
              },
            },
            rateLimit: RATE_LIMIT_SCHEMA,
          },
        }, ERROR_SCHEMA],
      },
      render: (_args, value) => {
        if ('status' in value) {
          return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }]
        }
        return renderPrSummary(value)
      },
      presentationMeta: identityMeta,
    },
    isConcurrencySafe: () => true,
    presentCall: ghReviewCall,
    presentResult: ghReviewResult,
    async execute(args, exec) {
      const ref = state.parsePrRef(args.pr)
      if (ref === null) return errorValue('invalid-pr', `"${args.pr}" is not a PR reference`, 'Use a number, "#number", "owner/repo#number", or a pull URL.')
      const repoResult = ref.repo !== undefined ? { ok: true as const, repo: ref.repo } : await state.resolveRepo(undefined, exec.signal)
      if (!repoResult.ok) return errorValue(repoResult.code, repoResult.message, repoResult.guidance)

      const token = await state.resolveToken(exec.signal)
      if (!token.ok) return errorValue(token.error.code, token.error.message, token.error.guidance)
      const client = state.client(token.token.value)
      const fields = new Set(args.fields ?? REVIEW_FIELDS)
      const maxDiffChars = args.maxDiffChars !== undefined && args.maxDiffChars > 0 ? Math.floor(args.maxDiffChars) : state.config.maxDiffChars

      let payload: PullPayload
      let rateLimit: PrSummaryValue['rateLimit']
      try {
        const metadataResponse = await client.requestJson<PullPayload>('GET', `/repos/${repoResult.repo}/pulls/${ref.number}`, { signal: exec.signal })
        payload = metadataResponse.data
        rateLimit = rateLimitValue(metadataResponse.rateLimit)
      } catch (error) {
        return githubErrorValue(error)
      }

      let diffText = ''
      let diffTruncated = false
      let diffError = false
      if (fields.has('diff') || fields.has('findings')) {
        try {
          const capped = capText((await client.requestText('GET', `/repos/${repoResult.repo}/pulls/${ref.number}`, { signal: exec.signal })).text, maxDiffChars)
          diffText = capped.text
          diffTruncated = capped.truncated
        } catch {
          diffError = true
        }
      }

      let comments: CommentPayload[] = []
      if (fields.has('comments')) {
        try {
          comments = (await client.requestJson<CommentPayload[]>('GET', `/repos/${repoResult.repo}/pulls/${ref.number}/comments?per_page=${state.config.maxComments}`, { signal: exec.signal })).data
        } catch {
          // Comments are supplementary; keep the rest of the summary.
        }
      }

      let ci: PrSummaryValue['ci'] = { summary: 'unknown' }
      if (fields.has('ci')) {
        try {
          const runs = (await client.requestJson<CheckRunsPayload>('GET', `/repos/${repoResult.repo}/commits/${payload.head?.sha ?? ''}/check-runs`, { signal: exec.signal })).data.check_runs ?? []
          ci = summarizeChecks(runs)
        } catch {
          // CI is supplementary; keep the rest of the summary.
        }
      }

      const findings: Finding[] = fields.has('findings') ? analyzeDiff(diffText, maxDiffChars).findings : []

      const value: PrSummaryValue = {
        repo: repoResult.repo,
        number: payload.number,
        title: payload.title,
        state: payload.state,
        author: payload.user?.login ?? 'unknown',
        url: payload.html_url,
        additions: payload.additions,
        deletions: payload.deletions,
        base: payload.base?.ref ?? '',
        head: payload.head?.ref ?? '',
        ci,
        comments: comments.map(comment => ({
          id: comment.id,
          user: comment.user?.login ?? 'unknown',
          ...comment.path !== null && comment.path !== undefined ? { path: comment.path } : {},
          ...comment.line !== null && comment.line !== undefined ? { line: comment.line } : {},
          body: comment.body ?? '',
        })),
        findings: findings.map(finding => ({ ...finding })),
        diff: {
          length: diffText.length,
          truncated: diffTruncated || diffError,
          excerpt: diffError ? '' : diffText.slice(0, 2000),
          files: diffError ? [] : parseDiffStats(diffText, maxDiffChars),
        },
        rateLimit,
      }
      return value
    },
  })
}

function renderPrSummary(value: PrSummaryValue): ContentBlock[] {
  const findings = value.findings ?? []
  const comments = value.comments ?? []
  const files = value.diff.files ?? []
  const lines = [
    `PR #${value.number} "${value.title}" (${value.state}) by ${value.author}`,
    `${value.repo} · ${value.base} ← ${value.head} · +${value.additions} −${value.deletions} · ${value.url}`,
    `CI: ${value.ci.summary}`,
    `Comments: ${comments.length} review comment(s); static findings: ${findings.length}`,
  ]
  for (const finding of findings.slice(0, 10)) {
    lines.push(`- [${finding.severity}] ${finding.rule} ${finding.file}${finding.line !== null && finding.line !== undefined ? `:${finding.line}` : ''}: ${finding.message}`)
  }
  if (findings.length > 10) lines.push(`… ${findings.length - 10} more findings`)
  lines.push(`Diff: ${value.diff.length} chars${value.diff.truncated ? ' (truncated)' : ''} across ${files.length} file(s)`)
  if (value.diff.excerpt.length > 0) lines.push(`Diff excerpt:\n${value.diff.excerpt}`)
  if (value.rateLimit?.remaining !== null && value.rateLimit?.remaining !== undefined) lines.push(`GitHub rate limit remaining: ${value.rateLimit.remaining}`)
  return [{ type: 'text', text: lines.join('\n') }]
}

function summarizeChecks(runs: Array<{ name?: string; status?: string; conclusion?: string | null }>): NonNullable<PrSummaryValue['ci']> {
  const normalized = runs.map(run => ({
    name: run.name ?? 'unnamed check',
    status: run.status ?? 'unknown',
    ...run.conclusion !== null && run.conclusion !== undefined ? { conclusion: run.conclusion } : {},
  }))
  if (normalized.length === 0) return { summary: 'no checks reported' }
  const pending = normalized.filter(run => run.status !== 'completed').length
  const failed = normalized.filter(run => run.conclusion !== undefined && run.conclusion !== 'success' && run.conclusion !== 'neutral' && run.conclusion !== 'skipped').length
  const status = pending > 0 ? 'in-progress' : 'completed'
  const conclusion = pending > 0 ? undefined : failed > 0 ? 'failure' : 'success'
  return { summary: `${normalized.length} check(s), ${pending} pending, ${failed} failed`, status, ...conclusion !== undefined ? { conclusion } : {}, runs: normalized }
}

/** `review_post`: publish a completed review job's comment (write; approval-gated upstream). */
export function reviewPostTool(state: GithubState) {
  return defineTool({
    name: 'review_post',
    description: 'Post the review comment drafted by a completed background review job (started with /review). '
      + 'Requires approval. jobId comes from the /review command output or job_list.',
    parameters: {
      jobId: { type: 'string', required: true, description: 'Id of a completed review job.' },
    },
    output: {
      schema: {
        oneOf: [{
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', required: true, const: 'posted' },
            url: { type: 'string', required: true },
            commentId: { type: 'integer', required: true },
            findings: { type: 'integer', required: true },
          },
        }, ERROR_SCHEMA],
      },
      render: (_args, value) => {
        if (value.status === 'error') return [{ type: 'text', text: value.message }]
        return [{ type: 'text', text: `posted review comment with ${value.findings} finding(s): ${value.url}` }]
      },
      presentationMeta: identityMeta,
    },
    isConcurrencySafe: () => false,
    presentCall: reviewPostCall,
    presentResult: reviewPostResult,
    async execute(args, exec) {
      const record = state.records.get(args.jobId)
      if (record === undefined) return errorValue('unknown-job', `no review job "${args.jobId}"`, 'List jobs with job_list and pick a github-review job id.')
      if (record.status !== 'completed' || record.report === null) {
        return errorValue('job-not-completed', `review job "${args.jobId}" has not completed`, 'Wait for the completion notice, then post.')
      }
      const token = await state.resolveToken(exec.signal)
      if (!token.ok) return errorValue(token.error.code, token.error.message, token.error.guidance)
      try {
        const posted = await state.client(token.token.value).requestJson<{ id: number; html_url: string }>(
          'POST', `/repos/${record.repo}/issues/${record.pr}/comments`,
          { signal: exec.signal, body: { body: record.report.postBody } },
        )
        return { status: 'posted', url: posted.data.html_url, commentId: posted.data.id, findings: record.report.findings.length } as const
      } catch (error) {
        return githubErrorValue(error)
      }
    },
  })
}

/** `gh_issue`: read issues (list / get / comments). Read-only. */
export function ghIssueTool(state: GithubState) {
  return defineTool({
    name: 'gh_issue',
    description: 'Read GitHub issues. `action`: "list" repository issues (filter by state), "get" one issue by '
      + 'number, or "comments" for one issue\'s comments. Read-only and concurrency-safe. Use issue_open to create.',
    parameters: {
      action: { type: 'string', required: true, enum: ['list', 'get', 'comments'], description: 'Which read to perform.' },
      ownerRepo: { type: 'string', description: 'Repository as owner/repo. Defaults to configured or git origin.' },
      issueNumber: { type: 'integer', description: 'Issue number; required for get and comments.' },
      state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Filter for list. Defaults to open.' },
      limit: { type: 'integer', description: 'Max items for list. Defaults to 30, capped at 100.' },
    },
    output: {
      schema: {
        oneOf: [{
          type: 'object',
          additionalProperties: false,
          properties: {
            repo: { type: 'string', required: true },
            action: { type: 'string', required: true, enum: ['list', 'get', 'comments'] },
            total: { type: 'integer', required: true },
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  number: { type: 'integer', required: true },
                  title: { type: 'string', required: true },
                  state: { type: 'string', required: true },
                  author: { type: 'string', required: true },
                  url: { type: 'string', required: true },
                  comments: { type: 'integer', required: true },
                  createdAt: { type: 'string', required: true },
                  body: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                },
              },
            },
            rateLimit: RATE_LIMIT_SCHEMA,
          },
        }, ERROR_SCHEMA],
      },
      render: (_args, value) => {
        if ('status' in value) {
          return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }]
        }
        return [{
          type: 'text',
          text: (value.items ?? []).length === 0
            ? `no issues in ${value.repo}`
            : (value.items ?? []).map(item => `#${item.number} ${item.title} [${item.state}] by ${item.author} — ${item.url}`).join('\n'),
        }]
      },
      presentationMeta: identityMeta,
    },
    isConcurrencySafe: () => true,
    presentCall: ghIssueCall,
    presentResult: ghIssueResult,
    async execute(args, exec) {
      if ((args.action === 'get' || args.action === 'comments') && args.issueNumber === undefined) {
        return errorValue('invalid-args', `action "${args.action}" requires issueNumber`)
      }
      const repoResult = await state.resolveRepo(args.ownerRepo, exec.signal)
      if (!repoResult.ok) return errorValue(repoResult.code, repoResult.message, repoResult.guidance)
      const token = await state.resolveToken(exec.signal)
      if (!token.ok) return errorValue(token.error.code, token.error.message, token.error.guidance)
      const client = state.client(token.token.value)

      let raw: IssuePayload[]
      let rateLimit = { remaining: null as number | null, resetAt: null as number | null }
      try {
        let response: { data: IssuePayload | IssuePayload[]; rateLimit: { remaining: number | null; resetAt: number | null } }
        if (args.action === 'list') {
          const limit = Math.min(Math.max(args.limit ?? 30, 1), 100)
          const listResponse = await client.requestJson<IssuePayload[]>('GET', `/repos/${repoResult.repo}/issues?state=${args.state ?? 'open'}&per_page=${limit}`, { signal: exec.signal })
          response = { data: listResponse.data, rateLimit: rateLimitValue(listResponse.rateLimit) }
        } else {
          const number = args.issueNumber as number
          const endpoint = args.action === 'get'
            ? `/repos/${repoResult.repo}/issues/${number}`
            : `/repos/${repoResult.repo}/issues/${number}/comments`
          const oneResponse = await client.requestJson<IssuePayload | IssuePayload[]>('GET', endpoint, { signal: exec.signal })
          response = { data: oneResponse.data, rateLimit: rateLimitValue(oneResponse.rateLimit) }
        }
        raw = Array.isArray(response.data) ? response.data : [response.data]
        rateLimit = response.rateLimit
      } catch (error) {
        return githubErrorValue(error)
      }

      const value: IssueListValue = {
        repo: repoResult.repo,
        action: args.action,
        total: raw.length,
        items: raw.map(item => ({
          number: item.number,
          title: item.title,
          state: item.state,
          author: item.user?.login ?? 'unknown',
          url: item.html_url,
          comments: item.comments ?? 0,
          createdAt: item.created_at ?? '',
          body: item.body ?? null,
        })),
        rateLimit,
      }
      return value
    },
  })
}

/** `issue_open`: create an issue (write; approval-gated upstream). */
export function issueOpenTool(state: GithubState) {
  return defineTool({
    name: 'issue_open',
    description: 'Create a GitHub issue. Requires approval. Returns the issue URL and number.',
    parameters: {
      title: { type: 'string', required: true, description: 'Issue title.' },
      body: { type: 'string', description: 'Issue body.' },
      labels: { type: 'array', items: { type: 'string' }, description: 'Label names to apply.' },
      ownerRepo: { type: 'string', description: 'Target repository as owner/repo. Defaults to configured or git origin.' },
    },
    output: {
      schema: {
        oneOf: [{
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', required: true, const: 'created' },
            url: { type: 'string', required: true },
            number: { type: 'integer', required: true },
            title: { type: 'string', required: true },
          },
        }, ERROR_SCHEMA],
      },
      render: (_args, value) => {
        if (value.status === 'error') {
          return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }]
        }
        return [{ type: 'text', text: `created issue #${value.number}: ${value.url}` }]
      },
      presentationMeta: identityMeta,
    },
    isConcurrencySafe: () => false,
    presentCall: issueOpenCall,
    presentResult: issueOpenResult,
    async execute(args, exec) {
      if (args.title.trim().length === 0) return errorValue('invalid-args', 'title must not be empty')
      const repo = await state.resolveRepo(args.ownerRepo, exec.signal)
      if (!repo.ok) return errorValue(repo.code, repo.message, repo.guidance)
      const token = await state.resolveToken(exec.signal)
      if (!token.ok) return errorValue(token.error.code, token.error.message, token.error.guidance)
      try {
        const created = await state.client(token.token.value).requestJson<{ id: number; number: number; title: string; html_url: string }>(
          'POST', `/repos/${repo.repo}/issues`,
          {
            signal: exec.signal,
            body: {
              title: args.title,
              ...args.body !== undefined ? { body: args.body } : {},
              ...args.labels !== undefined && args.labels.length > 0 ? { labels: args.labels } : {},
            },
          },
        )
        return { status: 'created', url: created.data.html_url, number: created.data.number, title: created.data.title } as const
      } catch (error) {
        return githubErrorValue(error)
      }
    },
  })
}
