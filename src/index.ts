/**
 * dsh-github: GitHub integration for DeepSeek Harness.
 *
 * Tools: pr_create / pr_merge / pr_update / review_post / issue_open /
 * issue_comment / issue_close / ci_run (writes), gh_review / gh_issue /
 * gh_search / gh_repo / gh_file (reads). Commands: /pr create, /review
 * (start|stop|post), /issue open, /ci (scan|status|start|stop|run — when
 * `ci.enabled`). Background review jobs run the deterministic analyzer by
 * default; `reviewMode: "model"` delegates the capped diff to a one-shot
 * subagent through the host's `subagents` seam. The CI surface (`ci.*`
 * config) adds the polling review bot, the status-check gate, and the
 * one-shot `ci_run` pipeline consumed by the composite action
 * (`action.yml`). Every GitHub write is gated by the tools/pre-execute
 * approval listener (default ask) and the allowedActions whitelist — except
 * the CI driver (`DSH_GITHUB_CI_DRIVER=1`), which auto-allows exactly the
 * actions listed in `ci.autoApprove`; the token travels only through the
 * credentials seam / environment / gh CLI and never reaches model-visible
 * text, session events, or logs.
 *
 * Model-visible ⇔ logged: the plugin appends NO custom session event types —
 * the host refuses logs with unknown out-of-repo event types, so all content
 * the model sees flows through the host's own logged surfaces: tool/result
 * canonical values, agent-injected user/message notices, command/run +
 * command/done lifecycle pairs, and the approval/asked + approval/decided
 * audit pair. See README.md "Architecture".
 * @module dsh-github
 */
import type { Context } from '@deepseek-ai/cordis'
import { createState } from './state.ts'
import { runGitCli, type GitRunner } from './git.ts'
import { runGhCli, type GhRunner } from './credential.ts'
import type { SubagentsService } from './types.ts'
import {
  prCreateTool, prMergeTool, prUpdateTool, ghReviewTool, reviewPostTool,
  ghIssueTool, issueOpenTool, issueCommentTool, issueCloseTool, ghSearchTool,
  ghRepoTool, ghFileTool,
} from './tools.ts'
import { registerApprovalGate } from './approval-gate.ts'
import { registerCommands } from './commands.ts'
import { registerCiBot } from './ci/bot.ts'
import { ciRunTool } from './ci/tool.ts'
import { Config, type Config as PluginConfig } from './config.ts'

export const name = 'dsh-github'

/** Services this plugin requires; all exist in any profile built on dsh-base. */
export const inject = ['tools', 'commands', 'jobs', 'approval', 'credentials']

export { Config }
export type { Config as PluginConfig }

/** Environment-dependent runners, injectable for tests. */
export interface PluginDeps {
  runGit?: GitRunner
  runGh?: GhRunner
  fetchImpl?: typeof fetch
}

/**
 * Apply the plugin with explicit environment runners.
 *
 * The production {@link apply} passes the real git/gh runners; tests inject
 * fakes through {@link applyWithDeps} so no test touches the network or a
 * real shell. Every registration is an effect — disposing the plugin fiber
 * reverses all of them.
 * @param ctx - plugin context; the injected services are ready at this point.
 * @param config - validated Schemastery configuration (defaults applied).
 * @param deps - optional git/gh/fetch runners.
 */
export function applyWithDeps(ctx: Context, config: PluginConfig, deps: PluginDeps = {}) {
  const state = createState({ credentials: ctx.credentials, subagents: ctx.get('subagents') as SubagentsService | undefined }, config, deps.runGit ?? runGitCli, deps.runGh ?? runGhCli, deps.fetchImpl)

  ctx.tools.register(prCreateTool(state))
  ctx.tools.register(prMergeTool(state))
  ctx.tools.register(prUpdateTool(state))
  ctx.tools.register(ghReviewTool(state))
  ctx.tools.register(reviewPostTool(state))
  ctx.tools.register(ghIssueTool(state))
  ctx.tools.register(issueOpenTool(state))
  ctx.tools.register(issueCommentTool(state))
  ctx.tools.register(issueCloseTool(state))
  ctx.tools.register(ghSearchTool(state))
  ctx.tools.register(ghRepoTool(state))
  ctx.tools.register(ghFileTool(state))
  if (config.ci.enabled) {
    ctx.tools.register(ciRunTool(state))
  }

  ctx.effect(() => registerApprovalGate(ctx, state))
  ctx.effect(() => registerCommands(ctx.commands, ctx.jobs, state))
  if (config.ci.enabled) {
    ctx.effect(() => registerCiBot(ctx, ctx.commands, state))
  }
}

/**
 * Apply the plugin: register tools, commands, and the write-approval gate.
 * @param ctx - plugin context; the injected services are ready at this point.
 * @param config - validated Schemastery configuration (defaults applied).
 */
export function apply(ctx: Context, config: PluginConfig) {
  applyWithDeps(ctx, config)
}
