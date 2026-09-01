/**
 * Tool three-interface suite (U2): the gh_repo tool keeps the model-visible
 * schema, the program-facing canonical value, and the model-facing content
 * blocks stable through the REAL tool registry. fetch/git/gh stay stubbed
 * (sealed; no network).
 * @module dsh-github/test/tool-interfaces
 */

import { Context, type Fiber } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { describe, expect, it } from 'vitest'
import { applyWithDeps, Config, type PluginConfig } from '../src/index.ts'
import { MockApproval, MockCommands, MockCredentials, MockJobs, TOKEN, jsonResponse, stubFetch } from './helpers.ts'

const REPO_PAYLOAD = {
  description: 'fixture repo',
  default_branch: 'main',
  visibility: 'public',
  stargazers_count: 12,
  forks_count: 3,
  open_issues_count: 5,
  language: 'TypeScript',
  license: { spdx_id: 'Apache-2.0' },
  topics: ['dsh', 'plugin'],
  html_url: 'https://github.com/o/r',
  updated_at: '2026-08-18T00:00:00Z',
}

async function mountRuntime() {
  const ctx = new Context()
  ctx.provide('systemPrompt', { tools: () => () => undefined, section: () => () => undefined } as never)
  await ctx.plugin(ToolRuntime)
  ctx.provide('commands', new MockCommands())
  ctx.provide('jobs', new MockJobs())
  ctx.provide('approval', new MockApproval())
  const credentials = new MockCredentials()
  credentials.values.set('GITHUB_TOKEN', TOKEN)
  ctx.provide('credentials', credentials)

  const config = Config({}) as PluginConfig
  const fiber: Fiber = await ctx.plugin({
    name: 'dsh-github',
    inject: ['tools', 'commands', 'jobs', 'approval', 'credentials'],
    apply: (child: Context, resolved: PluginConfig) => applyWithDeps(child, resolved, {
      runGit: async () => ({ stdout: '' }),
      runGh: async () => { throw new Error('gh unused') },
      fetchImpl: stubFetch([
        { match: (m: string, u: URL) => m === 'GET' && /\/repos\/[^/]+\/[^/]+$/.test(u.pathname), respond: () => jsonResponse(200, REPO_PAYLOAD) },
      ]),
    }),
  }, config)
  return { ctx, fiber }
}

describe('gh_repo tool three interfaces', () => {
  it('keeps the model schema, canonical value, and content blocks stable', async () => {
    const { ctx, fiber } = await mountRuntime()
    try {
      // 1. Model-visible schema: the registry's normalized projection.
      const schemas = ctx.tools.schemas()
      const schema = schemas.find(entry => entry.name === 'gh_repo')
      expect(schema).toBeDefined()
      expect(schema?.parameters).toMatchObject({
        type: 'object',
        properties: {
          ownerRepo: { type: 'string', description: expect.stringContaining('owner/repo') },
        },
      })

      // The tool definition's output schema declares both result branches.
      const output = ctx.tools.get('gh_repo')?.output?.schema
      expect(output).toMatchObject({ oneOf: expect.any(Array) })
      expect(output.oneOf).toHaveLength(2)

      // 2+3. One execution yields the canonical value AND the rendered content.
      const result = await ctx.tools.execute({
        callId: ToolCallId('dsh-github-three-interfaces'),
        name: 'gh_repo',
        arguments: { ownerRepo: 'o/r' },
        signal: new AbortController().signal,
      })
      expect(result.isError).toBe(false)
      expect(result.value).toEqual({
        repo: 'o/r',
        description: 'fixture repo',
        defaultBranch: 'main',
        visibility: 'public',
        stars: 12,
        forks: 3,
        openIssues: 5,
        language: 'TypeScript',
        license: 'Apache-2.0',
        topics: ['dsh', 'plugin'],
        url: 'https://github.com/o/r',
        updatedAt: '2026-08-18T00:00:00Z',
        rateLimit: expect.any(Object),
      })
      expect(result.content).toEqual([
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('o/r: fixture repo'),
        }),
      ])
      const text = result.content?.[0] as { text: string } | undefined
      expect(text?.text).toContain('stars 12 · forks 3 · open issues 5 · public')
    } finally {
      await fiber.dispose()
      await ctx.fiber.dispose()
    }
  })

  it('renders the error branch from its canonical value on a 404', async () => {
    const ctx = new Context()
    ctx.provide('systemPrompt', { tools: () => () => undefined, section: () => () => undefined } as never)
    await ctx.plugin(ToolRuntime)
    ctx.provide('commands', new MockCommands())
    ctx.provide('jobs', new MockJobs())
    ctx.provide('approval', new MockApproval())
    const credentials = new MockCredentials()
    credentials.values.set('GITHUB_TOKEN', TOKEN)
    ctx.provide('credentials', credentials)
    const config = Config({}) as PluginConfig
    const fiber: Fiber = await ctx.plugin({
      name: 'dsh-github',
      inject: ['tools', 'commands', 'jobs', 'approval', 'credentials'],
      apply: (child: Context, resolved: PluginConfig) => applyWithDeps(child, resolved, {
        runGit: async () => ({ stdout: '' }),
        runGh: async () => { throw new Error('gh unused') },
        fetchImpl: stubFetch([
          { match: (m: string, u: URL) => m === 'GET' && /\/repos\/[^/]+\/[^/]+$/.test(u.pathname), respond: () => jsonResponse(404, { message: 'Not Found' }) },
        ]),
      }),
    }, config)
    try {
      const result = await ctx.tools.execute({
        callId: ToolCallId('dsh-github-three-interfaces-error'),
        name: 'gh_repo',
        arguments: { ownerRepo: 'o/r' },
        signal: new AbortController().signal,
      })
      expect(result.isError).toBe(false)
      expect(result.value).toEqual(expect.objectContaining({ status: 'error' }))
      expect(result.value).toHaveProperty('message')
      expect(result.content).toEqual([
        expect.objectContaining({ type: 'text', text: expect.stringContaining('Not Found') }),
      ])
    } finally {
      await fiber.dispose()
      await ctx.fiber.dispose()
    }
  })
})
