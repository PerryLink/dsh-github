import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadPlugin, makeServices, stubFetch, jsonResponse, textResponse, TOKEN, MockAgent } from './helpers.ts'
import { analyzePr, globToRegExp, matchesAnyGlob } from '../src/ci/review-rules.ts'
import { formatMarkdownReport, hasReviewMarker, reviewMarker, verdictFor } from '../src/ci/pipeline.ts'
import type { CiConfig } from '../src/config.ts'
import { Config } from '../src/config.ts'

const SHA = 'abc123def456'
const PULL_META = {
  number: 7,
  title: 'feat: shiny',
  state: 'open',
  html_url: 'https://github.com/o/r/pull/7',
  additions: 12,
  deletions: 3,
  draft: false,
  user: { login: 'alice' },
  labels: [{ name: 'needs-review' }],
  head: { ref: 'feat/shiny', sha: SHA },
  base: { ref: 'main' },
}
const FILES_PAYLOAD = [{ filename: 'src/app.ts', additions: 5, deletions: 1 }]
const DIFF_TEXT = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 1111111..2222222 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1,3 +1,4 @@',
  ' const keep = 1',
  '+const token = "ghp_abcdefghijklmnopqrstu"',
  '+// TODO: wire the flag',
  ' ',
].join('\n')
const CLEAN_DIFF = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 1111111..2222222 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1 +1,2 @@',
  '+export const answer = 42',
  ' ',
].join('\n')

function acceptOf(init?: RequestInit): string {
  return String((init?.headers as Record<string, string> | undefined)?.Accept ?? '')
}

interface CiRoutesOptions {
  meta?: unknown
  diff?: string
  files?: unknown
  checkRuns?: unknown
  reviews?: unknown
  /** Captures the JSON bodies of POST /reviews and POST /check-runs. */
  posts?: Array<{ url: string; body: unknown }>
  /** Captures POST bodies only when the pathname matches this exact value. */
  openPulls?: unknown
}

/** Pipeline routes for `o/r` PR #7 with the default happy-path payloads. */
function ciRoutes(options: CiRoutesOptions = {}) {
  const posts = options.posts ?? []
  const capture = (init?: RequestInit, url?: string) => {
    if (url !== undefined) posts.push({ url, body: init?.body === undefined ? null : JSON.parse(String(init.body)) })
  }
  return [
    {
      match: (m: string, u: URL, init?: RequestInit) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7' && acceptOf(init).includes('diff'),
      respond: () => textResponse(200, options.diff ?? DIFF_TEXT),
    },
    {
      match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7',
      respond: () => jsonResponse(200, options.meta ?? PULL_META),
    },
    {
      match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7/files',
      respond: () => jsonResponse(200, options.files ?? FILES_PAYLOAD),
    },
    {
      match: (m: string, u: URL) => m === 'GET' && u.pathname === `/repos/o/r/commits/${SHA}/check-runs`,
      respond: () => jsonResponse(200, options.checkRuns ?? { total_count: 0, check_runs: [] }),
    },
    {
      match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls/7/reviews',
      respond: () => jsonResponse(200, options.reviews ?? []),
    },
    {
      match: (m: string, u: URL, init?: RequestInit) => m === 'POST' && u.pathname === '/repos/o/r/pulls/7/reviews',
      respond: (init?: RequestInit) => { capture(init, '/repos/o/r/pulls/7/reviews'); return jsonResponse(200, { id: 7, html_url: 'https://github.com/o/r/pull/7#pullrequestreview-7' }) },
    },
    {
      match: (m: string, u: URL, init?: RequestInit) => m === 'POST' && u.pathname === `/repos/o/r/commits/${SHA}/check-runs`,
      respond: (init?: RequestInit) => { capture(init, `/repos/o/r/commits/${SHA}/check-runs`); return jsonResponse(201, { id: 9, html_url: 'https://github.com/o/r/runs/9' }) },
    },
    ...(options.openPulls !== undefined ? [{
      match: (m: string, u: URL) => m === 'GET' && u.pathname === '/repos/o/r/pulls',
      respond: () => jsonResponse(200, options.openPulls),
    }] : []),
  ]
}

let reportDir: string

beforeEach(() => {
  reportDir = mkdtempSync(join(tmpdir(), 'dsh-github-ci-'))
  delete process.env.GITHUB_OUTPUT
  delete process.env.DSH_GITHUB_CI_DRIVER
})

afterEach(() => {
  rmSync(reportDir, { recursive: true, force: true })
  delete process.env.DSH_GITHUB_CI_DRIVER
})

async function loaded(routes = ciRoutes(), config: Record<string, unknown> = {}) {
  const services = makeServices()
  services.credentials.values.set('GITHUB_TOKEN', TOKEN)
  await loadPlugin(services, {
    config: {
      defaultOwnerRepo: 'o/r',
      ci: { enabled: true, pollIntervalMs: 0, reportDir },
      ...config,
    },
    runGit: async () => { throw new Error('git unused') },
    runGh: async () => { throw new Error('gh unused') },
    fetchImpl: stubFetch(routes),
  })
  return services
}

describe('review-rules', () => {
  it('translates globs with *, **, and ?; basename globs match at any depth', () => {
    expect(globToRegExp('src/**').test('src/a/b.ts')).toBe(true)
    expect(globToRegExp('src/**').test('src/a.ts')).toBe(true)
    expect(globToRegExp('*.pem').test('server.pem')).toBe(true)
    expect(globToRegExp('*.pem').test('certs/server.pem')).toBe(true) // basename glob
    expect(globToRegExp('.env').test('config/.env')).toBe(true)
    expect(globToRegExp('**/*.test.ts').test('a/b/x.test.ts')).toBe(true)
    expect(globToRegExp('file?.txt').test('file1.txt')).toBe(true)
    expect(globToRegExp('.github/workflows/*.yml').test('.github/workflows/ci.yml')).toBe(true)
  })

  it('flags sensitive files, oversized scope, and missing tests', () => {
    const options = {
      sensitivePathPatterns: ['.env', '**/secrets/**', '.github/workflows/*.yml'],
      sensitiveSeverity: 'warning' as const,
      codeExtensions: ['.ts'],
      testPathPatterns: ['**/*.test.ts', '**/test/**'],
      maxChangedFiles: 2,
      maxAddedLines: 100,
      maxRemovedLines: 100,
    }
    const findings = analyzePr({
      files: [
        { path: 'src/app.ts', added: 90, removed: 0 },
        { path: 'src/helper.ts', added: 5, removed: 0 },
        { path: 'config/.env', added: 1, removed: 0 },
        { path: '.github/workflows/ci.yml', added: 40, removed: 0 },
      ],
      additions: 136,
      deletions: 0,
      options,
    })
    const rules = findings.map(finding => finding.rule)
    expect(rules).toContain('sensitive-file')
    expect(rules).toContain('missing-tests')
    expect(rules).toContain('large-change')
    const sensitive = findings.filter(finding => finding.rule === 'sensitive-file')
    expect(sensitive).toHaveLength(2)
    expect(sensitive[0]?.severity).toBe('warning')
  })

  it('finds no missing-tests finding when tests changed alongside code', () => {
    const findings = analyzePr({
      files: [
        { path: 'src/app.ts', added: 5, removed: 0 },
        { path: 'src/app.test.ts', added: 3, removed: 0 },
      ],
      additions: 8,
      deletions: 0,
      options: {
        sensitivePathPatterns: [],
        sensitiveSeverity: 'warning',
        codeExtensions: ['.ts'],
        testPathPatterns: ['**/*.test.ts'],
        maxChangedFiles: 30,
        maxAddedLines: 1000,
        maxRemovedLines: 1000,
      },
    })
    expect(findings.some(finding => finding.rule === 'missing-tests')).toBe(false)
  })
})

describe('ci helpers', () => {
  it('computes the verdict from findings under the failOn policy', () => {
    expect(verdictFor([], 'error')).toBe('pass')
    expect(verdictFor([{ file: 'a', line: 1, severity: 'warning', rule: 'r', message: 'm' }], 'error')).toBe('pass')
    expect(verdictFor([{ file: 'a', line: 1, severity: 'warning', rule: 'r', message: 'm' }], 'warning')).toBe('needs-changes')
    expect(verdictFor([{ file: 'a', line: 1, severity: 'error', rule: 'r', message: 'm' }], 'error')).toBe('needs-changes')
  })

  it('derives the idempotency marker per head commit', () => {
    const marker = reviewMarker(SHA)
    expect(hasReviewMarker(`\n${marker}\n`, SHA)).toBe(true)
    expect(hasReviewMarker('no marker', SHA)).toBe(false)
  })

  it('formats a Markdown report with verdict and check facts', () => {
    const md = formatMarkdownReport({
      status: 'ok', repo: 'o/r', pr: 7, headSha: SHA, verdict: 'needs-changes', engine: 'static',
      findings: [{ file: 'src/a.ts', line: 3, severity: 'error', rule: 'hardcoded-secret', message: 'secret' }],
      summary: 'verdict needs-changes', truncated: false, alreadyReviewed: false,
      checkRun: { id: 1, url: 'https://example/checks/1', conclusion: 'failure' },
      rateLimit: { remaining: 10, resetAt: 0 },
    }, { blocking: true, checkName: 'dsh-github-review' })
    expect(md).toContain('Verdict: **needs-changes** (blocking)')
    expect(md).toContain('hardcoded-secret')
  })
})

describe('ci_run tool (pipeline)', () => {
  it('registers ci_run only when ci.enabled', async () => {
    const on = await loaded()
    expect(on.tools.get('ci_run').name).toBe('ci_run')
    const off = makeServices()
    off.credentials.values.set('GITHUB_TOKEN', TOKEN)
    await loadPlugin(off, { config: { defaultOwnerRepo: 'o/r' }, fetchImpl: stubFetch([]) })
    expect(off.tools.defs.has('ci_run')).toBe(false)
  })

  it('reviews a PR: posts comments and the check, writes reports, verdict pass', async () => {
    const posts: Array<{ url: string; body: unknown }> = []
    const services = await loaded(ciRoutes({ diff: CLEAN_DIFF, posts }))
    const value = await services.tools.run('ci_run', { task: 'review', pr: 'o/r#7' }) as Record<string, unknown>
    expect(value.status).toBe('ok')
    expect(value.verdict).toBe('pass') // CLEAN_DIFF has no line findings; missing-tests is a warning and failOn is error
    expect(value.alreadyReviewed).toBe(false)
    expect(value.checkRun).toMatchObject({ conclusion: 'success' })
    expect(value.review).toMatchObject({ inlineComments: 0 })
    const reviewPost = posts.find(post => post.url === '/repos/o/r/pulls/7/reviews')
    expect(reviewPost).toBeDefined()
    expect((reviewPost?.body as { body: string }).body.startsWith(reviewMarker(SHA))).toBe(true)
    expect(posts.some(post => post.url === `/repos/o/r/commits/${SHA}/check-runs`)).toBe(true)
    const jsonPath = join(reportDir, 'dsh-github-ci-result.json')
    const mdPath = join(reportDir, 'dsh-github-ci-summary.md')
    expect(readFileSync(jsonPath, 'utf8')).toContain('"verdict"')
    expect(readFileSync(mdPath, 'utf8')).toContain('Verdict: **pass**')
  })

  it('flags hardcoded secrets as error findings', async () => {
    const services = await loaded()
    const value = await services.tools.run('ci_run', { task: 'analyze', pr: 'o/r#7' }) as Record<string, unknown>
    expect(value.status).toBe('ok')
    const findings = value.findings as Array<{ rule: string; severity: string }>
    expect(findings.some(finding => finding.rule === 'hardcoded-secret' && finding.severity === 'error')).toBe(true)
    expect(value.diffText).toContain('ghp_')
    expect(value.checkRun).toBeUndefined()
    expect(value.review).toBeUndefined()
  })

  it('is idempotent: an already-published gate means no duplicate comments or checks', async () => {
    const posts: Array<{ url: string; body: unknown }> = []
    const services = await loaded(ciRoutes({
      posts,
      checkRuns: { total_count: 1, check_runs: [{ id: 5, name: 'dsh-github-review', status: 'completed', conclusion: 'success', html_url: 'https://example/checks/5' }] },
      reviews: [{ id: 3, body: `${reviewMarker(SHA)}\n## dsh-github review` }],
    }))
    const value = await services.tools.run('ci_run', { task: 'review', pr: 'o/r#7' }) as Record<string, unknown>
    expect(value.alreadyReviewed).toBe(true)
    expect(value.verdict).toBe('pass') // conclusion success → pass
    expect(value.checkRun).toMatchObject({ id: 5, conclusion: 'success' })
    expect(posts).toHaveLength(0)
  })

  it('skips filtered PRs with a neutral check and no comments', async () => {
    const posts: Array<{ url: string; body: unknown }> = []
    const services = await loaded(ciRoutes({ posts, meta: { ...PULL_META, labels: [{ name: 'other' }] } }), {
      ci: { enabled: true, pollIntervalMs: 0, reportDir, labelFilters: ['needs-review'] },
    })
    const value = await services.tools.run('ci_run', { task: 'review', pr: 'o/r#7' }) as Record<string, unknown>
    expect(value.verdict).toBe('skipped')
    expect(posts.some(post => post.url === '/repos/o/r/pulls/7/reviews')).toBe(false)
    const checkPost = posts.find(post => post.url === `/repos/o/r/commits/${SHA}/check-runs`)
    expect(checkPost).toBeDefined()
    expect(checkPost?.body).toMatchObject({ conclusion: 'neutral' })
  })

  it('publishes the model-authored body and merges its findings', async () => {
    const posts: Array<{ url: string; body: unknown }> = []
    const services = await loaded(ciRoutes({ diff: CLEAN_DIFF, posts }), { ci: { enabled: true, pollIntervalMs: 0, reportDir, failOn: 'error' } })
    const value = await services.tools.run('ci_run', {
      task: 'publish',
      pr: 'o/r#7',
      body: 'Reviewed: the flag wiring looks correct.',
      findings: [{ file: 'src/app.ts', line: 4, severity: 'error', rule: 'model-finding', message: 'state update races the render' }],
    }) as Record<string, unknown>
    expect(value.verdict).toBe('needs-changes')
    const reviewPost = posts.find(post => post.url === '/repos/o/r/pulls/7/reviews')
    expect((reviewPost?.body as { body: string }).body).toContain('Reviewed: the flag wiring looks correct.')
    const findings = value.findings as Array<{ rule: string }>
    expect(findings.some(finding => finding.rule === 'model-finding')).toBe(true)
  })

  it('returns a structured error without a token', async () => {
    const services = makeServices()
    await loadPlugin(services, {
      config: { defaultOwnerRepo: 'o/r', ci: { enabled: true, pollIntervalMs: 0, reportDir } },
      runGh: async () => { throw new Error('gh unused') },
      fetchImpl: stubFetch([]),
    })
    const value = await services.tools.run('ci_run', { task: 'review', pr: 'o/r#7' }) as Record<string, unknown>
    expect(value.status).toBe('error')
    expect(value.code).toBe('no-token')
  })
})

describe('ci approval gate', () => {
  function execLike(name: string, args: unknown) {
    return {
      callId: 'call-1',
      rootCallId: 'call-1',
      name,
      arguments: args,
      agent: new MockAgent(),
      signal: new AbortController().signal,
      token: Symbol('token'),
    }
  }

  async function decide(services: Awaited<ReturnType<typeof loaded>>, name: string, args: unknown) {
    return services.ctx.waterfall(
      'tools/pre-execute',
      execLike(name, args) as never,
      async () => ({ kind: 'allow' }) as never,
    )
  }

  it('asks for approval on ci_run in interactive sessions', async () => {
    const services = await loaded(ciRoutes(), { ci: { enabled: true, pollIntervalMs: 0, reportDir, autoApprove: [] } })
    const decision = await decide(services, 'ci_run', { task: 'review', pr: 'o/r#7' })
    expect(decision).toMatchObject({ kind: 'ask' })
    expect((decision as { reason: string }).reason).toContain('run CI review for GitHub pull request o/r#7')
  })

  it('auto-allows ci.run for the CI driver only when listed in ci.autoApprove', async () => {
    process.env.DSH_GITHUB_CI_DRIVER = '1'
    const allowed = await loaded(ciRoutes(), { ci: { enabled: true, pollIntervalMs: 0, reportDir, autoApprove: ['ci.run'] } })
    expect(await decide(allowed, 'ci_run', { task: 'review', pr: 'o/r#7' })).toMatchObject({ kind: 'allow' })
    // Other writes still ask even in driver mode unless listed.
    expect(await decide(allowed, 'pr_merge', { pr: 'o/r#7' })).toMatchObject({ kind: 'ask' })
    // Without the allowlist entry the driver asks too.
    const gated = await loaded(ciRoutes(), { ci: { enabled: true, pollIntervalMs: 0, reportDir, autoApprove: [] } })
    expect(await decide(gated, 'ci_run', { task: 'review', pr: 'o/r#7' })).toMatchObject({ kind: 'ask' })
  })
})

describe('/ci command family (bot)', () => {
  it('scans open PRs through the pipeline and reports the pass', async () => {
    const services = await loaded(ciRoutes({ diff: CLEAN_DIFF, openPulls: [{ number: 7, title: 'feat: shiny' }] }))
    const result = await services.commands.run('ci', 'scan', new MockAgent())
    expect(result.kind).toBe('success')
    expect(result.text).toContain('scanned 1 open PR(s)')
    expect(result.text).toContain('needs-changes') // missing-tests rule fires
  })

  it('runs one PR on demand and reports the check url', async () => {
    const services = await loaded()
    const result = await services.commands.run('ci', 'run o/r#7', new MockAgent())
    expect(result.kind).toBe('success')
    expect(result.text).toContain('verdict needs-changes')
    expect(result.text).toContain('check: https://github.com/o/r/runs/9')
  })

  it('reports status and toggles polling', async () => {
    const services = await loaded(ciRoutes(), { ci: { enabled: true, pollIntervalMs: 0, reportDir } })
    const status = await services.commands.run('ci', 'status', new MockAgent())
    expect(status.text).toContain('polling: off')
    const start = await services.commands.run('ci', 'start', new MockAgent())
    expect(start.kind).toBe('error') // pollIntervalMs is 0
    const stop = await services.commands.run('ci', 'stop', new MockAgent())
    expect(stop.text).toContain('polling disabled')
  })
})

describe('ci config schema', () => {
  it('applies nested defaults for a partial ci block and a missing ci block', () => {
    const partial = Config({ ci: { enabled: true } }) as { ci: CiConfig }
    expect(partial.ci.enabled).toBe(true)
    expect(partial.ci.checkName).toBe('dsh-github-review')
    expect(partial.ci.blocking).toBe(true)
    expect(partial.ci.sensitivePathPatterns).toContain('.github/workflows/*.yml')
    const missing = Config({}) as { ci: CiConfig | undefined }
    expect(missing.ci === undefined || missing.ci.checkName === 'dsh-github-review').toBe(true)
  })

  it('defaults requestTimeoutMs and keeps it bounded', () => {
    const resolved = Config({}) as { requestTimeoutMs: number }
    expect(resolved.requestTimeoutMs).toBe(30_000)
  })
})
