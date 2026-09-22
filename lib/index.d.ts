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
import type { Context } from '@deepseek-ai/cordis';
import { type GitRunner } from './git.js';
import { type GhRunner } from './credential.js';
import { Config, type Config as PluginConfig } from './config.js';
export declare const name = "dsh-github";
/** Services this plugin requires; all exist in any profile built on dsh-base. */
export declare const inject: string[];
export { Config };
export type { Config as PluginConfig };
/**
 * Profile entry id owned by this plugin. It no longer names a settings
 * namespace: since 0.1.7-alpha.1 the host has no
 * `ctx.settings.register(namespace, schema)` seam, and the browser card reads
 * the plugin's ordinary cordis.yml Config instead. The GitHub token itself
 * never rides configuration — it goes through the credentials seam, resolved
 * per operation, addressed by `Config.tokenRef`.
 */
export declare const GITHUB_SETTINGS_NAMESPACE = "dsh-github";
/** Environment-dependent runners, injectable for tests. */
export interface PluginDeps {
    runGit?: GitRunner;
    runGh?: GhRunner;
    fetchImpl?: typeof fetch;
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
export declare function applyWithDeps(ctx: Context, config: PluginConfig, deps?: PluginDeps): void;
/**
 * Apply the plugin: register the GitHub tools, the human commands, and the
 * write-approval gate.
 *
 * The plugin no longer registers a settings namespace: the host removed the
 * `ctx.settings.register(namespace, schema)` seam in 0.1.7-alpha.1. Every
 * tunable stays a cordis.yml `Config` field (see {@link Config}), and the
 * token keeps travelling through the credentials seam, resolved per operation.
 * @param ctx - plugin context; the injected services are ready at this point.
 * @param config - validated Schemastery configuration (defaults applied).
 */
export declare function apply(ctx: Context, config: PluginConfig): void;
//# sourceMappingURL=index.d.ts.map