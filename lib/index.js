import { createState } from "./state.js";
import { runGitCli } from "./git.js";
import { runGhCli } from "./credential.js";
import { prCreateTool, prMergeTool, prUpdateTool, ghReviewTool, reviewPostTool, ghIssueTool, issueOpenTool, issueCommentTool, issueCloseTool, ghSearchTool, ghRepoTool, ghFileTool, ghRepoSearchTool, ghChecksTool, } from "./tools.js";
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
 * Profile entry id owned by this plugin. It no longer names a settings
 * namespace: since 0.1.7-alpha.1 the host has no
 * `ctx.settings.register(namespace, schema)` seam, and the browser card reads
 * the plugin's ordinary cordis.yml Config instead. The GitHub token itself
 * never rides configuration — it goes through the credentials seam, resolved
 * per operation, addressed by `Config.tokenRef`.
 */
export const GITHUB_SETTINGS_NAMESPACE = 'dsh-github';
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
    // Consumer — the tool handlers consume the credentials service, the
    // optional subagents seam, and the git/gh runners assembled into `state`.
    // The subagents seam is optional at runtime although the official type
    // declares it non-optional; the cast through unknown keeps the plugin's
    // minimal structural face (see types.ts).
    const state = createState({ credentials: ctx.credentials, subagents: ctx.get('subagents') }, config, deps.runGit ?? runGitCli, deps.runGh ?? runGhCli, deps.fetchImpl);
    // Service Provider — registers the GitHub tools on ctx.tools; the /pr
    // /review /issue /ci commands and the write-approval gate register through
    // the effects below.
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
    ctx.tools.register(ghRepoSearchTool(state));
    ctx.tools.register(ghChecksTool(state));
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
export function apply(ctx, config) {
    applyWithDeps(ctx, config);
}
//# sourceMappingURL=index.js.map