import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import z from '@deepseek-ai/schemastery';
import { createState } from "./state.js";
import { runGitCli } from "./git.js";
import { runGhCli } from "./credential.js";
import { prCreateTool, prMergeTool, prUpdateTool, ghReviewTool, reviewPostTool, ghIssueTool, issueOpenTool, issueCommentTool, issueCloseTool, ghSearchTool, ghRepoTool, ghFileTool, } from "./tools.js";
import { registerApprovalGate } from "./approval-gate.js";
import { registerCommands } from "./commands.js";
import { registerCiBot } from "./ci/bot.js";
import { ciRunTool } from "./ci/tool.js";
import { Config } from "./config.js";
export const name = 'dsh-github';
/** Services this plugin requires; all exist in any profile built on dsh-base. */
export const inject = ['tools', 'commands', 'jobs', 'approval', 'credentials'];
export { Config };
/**
 * User-settings namespace owned by this plugin. The card in the "Plugins"
 * settings section edits this namespace; the GitHub token itself travels
 * through the credentials seam (never a settings field), addressed by
 * {@link GithubSettingsSchema.tokenRef}.
 */
export const GITHUB_SETTINGS_NAMESPACE = settingsNamespace('dsh-github');
/**
 * Settings surface for the browser configuration card. Only the fields that
 * make sense to edit from the settings page are exposed here; every other
 * tunable stays a cordis.yml entry config field.
 */
export const GithubSettingsSchema = z.object({
    tokenRef: z.string().pattern(/^[A-Za-z_][A-Za-z0-9_]*$/).default('GITHUB_TOKEN')
        .description('Credential reference / environment variable name holding the token.'),
    tokenSource: z.union(['auto', 'credentials', 'env', 'gh']).default('auto')
        .description('Token lookup source: auto tries credentials → env → gh in order.'),
});
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
export function applyWithDeps(ctx, config, deps = {}) {
    const state = createState({ credentials: ctx.credentials, subagents: ctx.get('subagents') }, config, deps.runGit ?? runGitCli, deps.runGh ?? runGhCli, deps.fetchImpl);
    ctx.tools.register(prCreateTool(state));
    ctx.tools.register(prMergeTool(state));
    ctx.tools.register(prUpdateTool(state));
    ctx.tools.register(ghReviewTool(state));
    ctx.tools.register(reviewPostTool(state));
    ctx.tools.register(ghIssueTool(state));
    ctx.tools.register(issueOpenTool(state));
    ctx.tools.register(issueCommentTool(state));
    ctx.tools.register(issueCloseTool(state));
    ctx.tools.register(ghSearchTool(state));
    ctx.tools.register(ghRepoTool(state));
    ctx.tools.register(ghFileTool(state));
    if (config.ci.enabled) {
        ctx.tools.register(ciRunTool(state));
    }
    ctx.effect(() => registerApprovalGate(ctx, state));
    ctx.effect(() => registerCommands(ctx.commands, ctx.jobs, state));
    if (config.ci.enabled) {
        ctx.effect(() => registerCiBot(ctx, ctx.commands, state));
    }
}
/**
 * Apply the plugin: register tools, commands, the write-approval gate, and the
 * user-settings namespace backing the browser configuration card.
 * @param ctx - plugin context; the injected services are ready at this point.
 * @param config - validated Schemastery configuration (defaults applied).
 */
export function apply(ctx, config) {
    applyWithDeps(ctx, config);
    // Optional settings service (present in any profile built on dsh-base):
    // register the namespace the "Plugins" settings card edits. The token
    // literal itself never rides this namespace — it goes through the
    // credentials seam, resolved per operation.
    ctx.inject(['settings'], (settingsCtx) => {
        settingsCtx.settings.register(GITHUB_SETTINGS_NAMESPACE, GithubSettingsSchema);
    });
}
//# sourceMappingURL=index.js.map