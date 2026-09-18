import { runCiPipeline } from "./pipeline.js";
const SCAN_CAP = 50;
/**
 * Create the polling bot and register the `/ci` command family. Everything
 * here is an effect of the calling fiber — disposing the plugin stops the
 * interval and removes the commands.
 * @param ctx - plugin context (owns the effect lifetime).
 * @param commands - the host command registry.
 * @param state - shared plugin state.
 * @returns the bot handle (also returned by the effect disposer path).
 */
export function registerCiBot(ctx, commands, state) {
    let polling = state.config.ci.pollIntervalMs > 0;
    let scanning = false;
    let lastScanAt = null;
    let lastScanPrs = 0;
    let lastScanNeedsChanges = 0;
    let lastScanErrors = 0;
    let lastScanSummary = 'no scan yet';
    const status = () => ({
        polling,
        scanning,
        intervalMs: state.config.ci.pollIntervalMs,
        lastScanAt,
        lastScanPrs,
        lastScanNeedsChanges,
        lastScanErrors,
        lastScanSummary,
    });
    const setPolling = (enabled) => {
        polling = enabled;
    };
    /** One pass over the open PRs: pipeline per PR under the concurrency cap. */
    const scan = async (signal) => {
        if (scanning)
            return 'a scan is already running';
        scanning = true;
        const started = Date.now();
        let needsChanges = 0;
        let errors = 0;
        let reviewed = 0;
        try {
            const token = await state.resolveToken(signal);
            if (!token.ok) {
                lastScanErrors += 1;
                lastScanSummary = `scan failed: ${token.error.message}`;
                ctx.logger.warn(`dsh-github ci bot: ${token.error.message}`);
                return lastScanSummary;
            }
            const client = state.client(token.token.value);
            const repo = await state.resolveRepo(undefined, signal);
            if (!repo.ok) {
                lastScanErrors += 1;
                lastScanSummary = `scan failed: ${repo.message}`;
                ctx.logger.warn(`dsh-github ci bot: ${repo.message}`);
                return lastScanSummary;
            }
            const open = await client.requestJson('GET', `/repos/${repo.repo}/pulls?state=open&per_page=${SCAN_CAP}`, { signal });
            const prs = open.data.filter(item => item.number !== undefined).slice(0, SCAN_CAP);
            const cap = state.config.ci.maxConcurrent;
            const queue = [...prs];
            const workers = Array.from({ length: Math.min(cap, queue.length) }, async () => {
                for (;;) {
                    const item = queue.shift();
                    if (item === undefined)
                        return;
                    try {
                        const outcome = await runCiPipeline(state, { repo: repo.repo, pr: item.number, task: 'review', signal });
                        if (outcome.status === 'error') {
                            errors += 1;
                            ctx.logger.warn(`dsh-github ci bot: PR #${item.number} review failed: ${outcome.message}`);
                        }
                        else {
                            reviewed += 1;
                            if (outcome.verdict === 'needs-changes')
                                needsChanges += 1;
                            ctx.logger.info(`dsh-github ci bot: PR #${item.number} → ${outcome.verdict}${outcome.alreadyReviewed ? ' (already reviewed)' : ''}`);
                        }
                    }
                    catch (error) {
                        errors += 1;
                        ctx.logger.warn(`dsh-github ci bot: PR #${item.number} review threw: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            });
            await Promise.all(workers);
            lastScanAt = Date.now();
            lastScanPrs = reviewed;
            lastScanNeedsChanges = needsChanges;
            lastScanErrors = errors;
            lastScanSummary = `scanned ${prs.length} open PR(s) in ${repo.repo}: ${reviewed} reviewed, ${needsChanges} needs-changes, ${errors} error(s) (${Date.now() - started}ms)`;
            return lastScanSummary;
        }
        finally {
            scanning = false;
        }
    };
    /**
     * One polling tick; the scan loop owns its own concurrency guard.
     */
    const tick = () => {
        if (polling)
            void scan().catch(() => { });
    };
    // The polling loop runs as a registry-owned background job (`github-ci-N`)
    // so the jobs controller can see and stop it. When no job controller serves
    // unowned work (the composition lacks tool-jobs), the registry's start
    // refuses, and the loop degrades to the legacy interval — logged once.
    let pollJobId;
    let fallbackTimer;
    let warnedFallback = false;
    if (state.config.ci.pollIntervalMs > 0) {
        const intervalMs = state.config.ci.pollIntervalMs;
        try {
            pollJobId = ctx.jobs.start({
                kind: 'github-ci',
                label: 'dsh-github CI bot polling',
                run: () => {
                    const timer = setInterval(tick, intervalMs);
                    timer.unref?.();
                    let settle;
                    const done = new Promise((resolve) => { settle = resolve; });
                    return {
                        cancel: (reason) => {
                            clearInterval(timer);
                            settle({ status: 'killed', detail: reason ?? 'polling disabled' });
                        },
                        done,
                    };
                },
            });
        }
        catch (error) {
            fallbackTimer = setInterval(tick, intervalMs);
            fallbackTimer.unref?.();
            if (!warnedFallback) {
                warnedFallback = true;
                ctx.logger.warn(`dsh-github ci bot: no job controller serves the polling job (${error instanceof Error ? error.message : String(error)}); polling falls back to an interval. Load @deepseek-ai/dsh-tool-jobs to make the loop a visible job.`);
            }
        }
    }
    const register = (name, description, hint, handler) => commands.register({ name, description, input: { hint }, handler });
    const disposers = [
        register('ci', 'CI review bot: scan PRs, publish reviews and the status-check gate', 'scan | status | start | stop | run <pr>', async (invocation) => {
            const [sub, ...rest] = invocation.rawInput.trim().split(/\s+/);
            if (sub === undefined || sub.length === 0) {
                const current = status();
                return { kind: 'success', text: `CI bot: polling ${current.polling ? `on (every ${current.intervalMs}ms)` : 'off'}\n${current.lastScanSummary}\nUsage: /ci scan | status | start | stop | run <pr>` };
            }
            if (sub === 'scan') {
                const result = await scan(invocation.signal);
                return { kind: 'success', text: result };
            }
            if (sub === 'status') {
                const current = status();
                return {
                    kind: 'success',
                    text: `polling: ${current.polling ? `on (every ${current.intervalMs}ms)` : 'off'}\n`
                        + `last scan: ${current.lastScanAt === null ? 'never' : new Date(current.lastScanAt).toISOString()}\n`
                        + `${current.lastScanSummary}`,
                };
            }
            if (sub === 'start') {
                if (state.config.ci.pollIntervalMs === 0) {
                    return { kind: 'error', text: 'ci.pollIntervalMs is 0: set a positive interval in cordis.yml to enable polling (or keep using /ci scan on demand).' };
                }
                setPolling(true);
                return { kind: 'success', text: `CI bot polling enabled (every ${state.config.ci.pollIntervalMs}ms). Set ci.pollIntervalMs to 0 to disable at boot.` };
            }
            if (sub === 'stop') {
                setPolling(false);
                return { kind: 'success', text: 'CI bot polling disabled; /ci scan still runs on demand.' };
            }
            if (sub === 'run') {
                const target = rest.join(' ').trim();
                if (target.length === 0)
                    return { kind: 'error', text: 'Usage: /ci run <pr> (number, #number, owner/repo#number, or pull URL)' };
                const ref = state.parsePrRef(target);
                if (ref === null)
                    return { kind: 'error', text: `"${target}" is not a PR reference. Use a number, "#number", "owner/repo#number", or a pull URL.` };
                const repoResult = ref.repo !== undefined ? { ok: true, repo: ref.repo } : await state.resolveRepo(undefined, invocation.signal);
                if (!repoResult.ok)
                    return { kind: 'error', text: `${repoResult.message}. ${repoResult.guidance}` };
                const outcome = await runCiPipeline(state, { repo: repoResult.repo, pr: ref.number, task: 'review', signal: invocation.signal });
                if (outcome.status === 'error')
                    return { kind: 'error', text: `${outcome.message}${outcome.guidance !== undefined ? `\n${outcome.guidance}` : ''}` };
                return {
                    kind: 'success',
                    text: `PR #${outcome.pr} (${outcome.repo}): verdict ${outcome.verdict}${outcome.alreadyReviewed ? ' (already reviewed at this head commit)' : ''}\n${outcome.summary}`
                        + `${outcome.checkRun !== undefined ? `\ncheck: ${outcome.checkRun.url} (${outcome.checkRun.conclusion})` : ''}`
                        + `${outcome.review !== undefined && outcome.review.url.length > 0 ? `\nreview: ${outcome.review.url}` : ''}`
                        + `${outcome.files !== undefined ? `\nreports: ${outcome.files.json} · ${outcome.files.markdown}` : ''}`,
                };
            }
            return { kind: 'error', text: `unknown /ci subcommand "${sub}". Usage: /ci scan | status | start | stop | run <pr>` };
        }),
    ];
    return () => {
        if (pollJobId !== undefined)
            ctx.jobs.kill(pollJobId, undefined, 'dsh-github dispose');
        if (fallbackTimer !== undefined)
            clearInterval(fallbackTimer);
        for (const dispose of disposers)
            dispose();
    };
}
//# sourceMappingURL=bot.js.map