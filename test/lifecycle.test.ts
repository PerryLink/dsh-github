/**
 * Lifecycle and export-contract suite: the HMR-safety test (dispose the
 * contributing fiber, re-query the authoritative REAL tool registry), and the
 * default-export guard (module namespace + Loader unwrap round-trip).
 * @module dsh-github/test/lifecycle
 */

import { Context, type Fiber } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index.ts'
import { applyWithDeps, Config, type PluginConfig } from '../src/index.ts'
import { MockApproval, MockCommands, MockCredentials, MockJobs } from './helpers.ts'

/** The twelve tools registered when the CI surface is off (ci.enabled=false). */
const BASE_TOOLS = [
  'pr_create', 'pr_merge', 'pr_update', 'review_post',
  'issue_open', 'issue_comment', 'issue_close',
  'gh_review', 'gh_issue', 'gh_search', 'gh_repo', 'gh_file',
]

// ---------------------------------------------------------------------------
// C2: the function-plugin namespace must survive Loader unwrapping
// ---------------------------------------------------------------------------

describe('export contract', () => {
  it('carries no default export and Loader unwrap round-trips the namespace', () => {
    expect('default' in plugin).toBe(false)
    const unwrapped = Object.create(Loader.prototype).unwrapExports(plugin)
    expect(unwrapped).toBe(plugin)
    expect(unwrapped.name).toBe('dsh-github')
    expect(unwrapped.inject).toEqual(['tools', 'commands', 'jobs', 'approval', 'credentials'])
    expect(unwrapped.Config).not.toBeUndefined()
    expect(typeof unwrapped.apply).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// C1: disposing the contributing fiber removes the tool contributions
// ---------------------------------------------------------------------------

describe('fiber disposal', () => {
  it('removes the registered tools from the REAL tool registry on dispose', async () => {
    const ctx = new Context()
    ctx.provide('systemPrompt', { tools: () => () => undefined, section: () => () => undefined } as never)
    await ctx.plugin(ToolRuntime)
    ctx.provide('commands', new MockCommands())
    ctx.provide('jobs', new MockJobs())
    ctx.provide('approval', new MockApproval())
    ctx.provide('credentials', new MockCredentials())

    const config = Config({}) as PluginConfig
    const fiber: Fiber = await ctx.plugin({
      name: 'dsh-github',
      inject: ['tools', 'commands', 'jobs', 'approval', 'credentials'],
      apply: (child: Context, resolved: PluginConfig) => applyWithDeps(child, resolved, {
        runGit: async () => ({ stdout: '' }),
        runGh: async () => ({ stdout: '' }),
        fetchImpl: async () => { throw new Error('no network in tests') },
      }),
    }, config)

    try {
      for (const name of BASE_TOOLS) {
        expect(ctx.tools.get(name)).toBeDefined()
      }
      // ci_run is only registered when ci.enabled; the default leaves it out.
      expect(ctx.tools.get('ci_run')).toBeUndefined()

      await fiber.dispose()

      for (const name of BASE_TOOLS) {
        expect(ctx.tools.get(name)).toBeUndefined()
      }
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
