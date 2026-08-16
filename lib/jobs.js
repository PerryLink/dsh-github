/**
 * Background review-job producer for `/review <pr>`.
 *
 * The job fetches the PR metadata (capturing the head-commit SHA for later
 * inline review posting), the capped diff, and — when requested — the CI
 * check runs and the existing review comments, then runs the deterministic
 * multi-file analyzer and stores the report in the plugin's in-memory record
 * map. Supplementary fetch failures (CI, comments) never fail the job; they
 * are noted in the completion output. Completion notices are delivered by the
 * host's tool-jobs consumer (followup for an idle owner, inject for a busy
 * one); the model then reads the report with the existing job_output tool and
 * posts it with review_post after approval. The job itself never writes to
 * GitHub.
 * @module dsh-github/jobs
 */
import { analyzeDiff } from "./review.js";
/** Producer kind — also the `<kind>-N` id prefix; the host treats it as opaque. */
export const REVIEW_JOB_KIND = 'github-review';
/**
 * Start one background review job and register its in-memory record.
 *
 * The token is resolved inside the run body (per-operation, per the
 * credentials-seam contract); a missing token settles the job as `failed`
 * with configuration guidance, never with a token value. `start` throws when
 * no job controller serves the owner — callers surface that as a command
 * error. With `reviewMode: "model"`, the subagent seam must be composed or
 * this call fails loud before starting the job.
 * @param registry - `ctx.jobs` of the hosting context.
 * @param state - plugin state holding config, token resolution, and records.
 * @param input - target PR, label, owning agent, and job options.
 * @returns the registry-issued `<kind>-N` id.
 */
export function startReviewJob(registry, state, input) {
    if (state.config.reviewMode === 'model' && state.subagents === undefined) {
        throw new Error('reviewMode "model" requires the subagent seam: load @deepseek-ai/dsh-subagent with an in-process provider '
            + '(e.g. @deepseek-ai/dsh-subagent-spawn-in-process) in the agent composition, or set reviewMode to "static".');
    }
    const record = {
        status: 'running',
        repo: input.repo,
        pr: input.pr,
        report: null,
    };
    const jobInput = {
        ...input,
        timeoutMs: input.timeoutMs ?? state.config.reviewJobTimeoutMs,
        maxDiffChars: input.maxDiffChars ?? state.config.maxDiffChars,
        includeCi: input.includeCi ?? true,
        includeComments: input.includeComments ?? true,
    };
    const spec = {
        kind: REVIEW_JOB_KIND,
        label: input.label,
        owner: input.owner,
        outputLimitBytes: 64 * 1024,
        run: () => runReviewWork(state, record, jobInput),
    };
    const id = registry.start(spec);
    state.rememberRecord(id, record);
    return id;
}
/** Run the review work and settle exactly one terminal outcome. */
function runReviewWork(state, record, input) {
    const controller = new AbortController();
    let cancelReason;
    const timer = setTimeout(() => {
        cancelReason ??= 'timeout';
        controller.abort(new Error('review job timed out'));
    }, input.timeoutMs);
    const done = (async () => {
        try {
            const token = await state.resolveToken(controller.signal);
            const abortedAfterToken = abortedOutcome(controller, cancelReason);
            if (abortedAfterToken !== null) {
                record.status = abortedAfterToken.status === 'killed' ? 'killed' : 'failed';
                return abortedAfterToken;
            }
            if (!token.ok) {
                record.status = 'failed';
                record.error = token.error.message;
                return { status: 'failed', detail: 'no GitHub token', output: `${token.error.message}\n${token.error.guidance}` };
            }
            const client = state.client(token.token.value);
            const metadata = await client.requestJson('GET', `/repos/${record.repo}/pulls/${record.pr}`, { signal: controller.signal });
            const abortedAfterMetadata = abortedOutcome(controller, cancelReason);
            if (abortedAfterMetadata !== null) {
                record.status = abortedAfterMetadata.status === 'killed' ? 'killed' : 'failed';
                return abortedAfterMetadata;
            }
            record.headSha = metadata.data.head?.sha;
            const diff = await client.requestText('GET', `/repos/${record.repo}/pulls/${record.pr}`, { signal: controller.signal });
            const abortedAfterDiff = abortedOutcome(controller, cancelReason);
            if (abortedAfterDiff !== null) {
                record.status = abortedAfterDiff.status === 'killed' ? 'killed' : 'failed';
                return abortedAfterDiff;
            }
            const truncated = diff.text.length > input.maxDiffChars;
            const capped = truncated ? diff.text.slice(0, input.maxDiffChars) : diff.text;
            if (state.config.reviewMode === 'model') {
                return runModelReview(state, record, input.owner, controller, cancelReason, capped, truncated);
            }
            const report = analyzeDiff(capped, input.maxDiffChars, { maxFindings: state.config.maxFindings, maxLineLength: state.config.maxLineLength });
            record.report = report;
            const notes = [];
            if (input.includeCi) {
                try {
                    const ci = await client.requestJson('GET', `/repos/${record.repo}/commits/${record.headSha ?? ''}/check-runs`, { signal: controller.signal });
                    record.ciSummary = summarizeChecks(ci.data.check_runs ?? []);
                    notes.push(`CI: ${record.ciSummary}`);
                }
                catch {
                    notes.push('CI: unavailable');
                }
            }
            if (input.includeComments) {
                try {
                    const comments = await client.requestJson('GET', `/repos/${record.repo}/pulls/${record.pr}/comments?per_page=${state.config.maxComments}`, { signal: controller.signal });
                    record.commentsCount = comments.data.length;
                    notes.push(`existing review comments: ${comments.data.length}`);
                }
                catch {
                    notes.push('existing review comments: unavailable');
                }
            }
            record.status = 'completed';
            const detail = `${report.findings.length} finding(s)`;
            const output = [report.summary, ...notes].join('\n');
            return { status: 'completed', detail, output };
        }
        catch (error) {
            const aborted = abortedOutcome(controller, cancelReason);
            if (aborted !== null) {
                record.status = aborted.status === 'killed' ? 'killed' : 'failed';
                return aborted;
            }
            record.status = 'failed';
            const message = error instanceof Error ? error.message : 'review failed';
            record.error = message;
            return { status: 'failed', detail: message };
        }
        finally {
            clearTimeout(timer);
        }
    })();
    return {
        cancel: (reason) => {
            cancelReason = reason ?? 'cancelled';
            controller.abort();
        },
        done,
    };
}
/** Review prompt for the one-shot subagent (model review). */
function modelReviewPrompt(record, diffText, truncated) {
    return [
        `Review the following GitHub pull request diff for PR #${record.pr} in ${record.repo}.`,
        'You are a careful code reviewer. Analyze correctness, security, style, and maintainability.',
        'Write the review as GitHub-flavored Markdown suitable for posting as a PR comment:',
        '- a short overall verdict first,',
        '- then concrete findings grouped by file with line numbers where possible.',
        'Report only actionable findings; do not praise or pad.',
        'This is a READ-ONLY review: do not modify files, do not create or comment on any issue or pull request.',
        truncated ? 'Note: the diff below was truncated to the configured cap; the review covers only the examined range.' : '',
        'Diff:',
        '```diff',
        diffText,
        '```',
    ].join('\n');
}
/** Model-review branch: delegate the capped diff to a one-shot subagent. */
async function runModelReview(state, record, owner, controller, cancelReason, diffText, truncated) {
    const subagents = state.subagents;
    if (subagents === undefined) {
        // startReviewJob fails loud first; this is unreachable in practice but keeps the type honest.
        record.status = 'failed';
        record.error = 'model review requires the subagent seam';
        return { status: 'failed', detail: 'model review unavailable', output: 'Model review requires the subagent seam; set reviewMode to "static" or load @deepseek-ai/dsh-subagent with a provider.' };
    }
    const provider = state.config.modelReviewProvider ?? subagents.list()[0];
    if (provider === undefined) {
        record.status = 'failed';
        record.error = 'no subagent provider registered';
        return {
            status: 'failed',
            detail: 'no subagent provider',
            output: 'No subagent provider is registered on the subagents seam. Load a provider package '
                + '(e.g. @deepseek-ai/dsh-subagent-spawn-in-process), or set reviewMode to "static".',
        };
    }
    try {
        const run = await subagents.start(provider, {
            label: `review PR #${record.pr} (${record.repo})`,
            prompt: [{ type: 'text', text: modelReviewPrompt(record, diffText, truncated) }],
            parent: owner,
            signal: controller.signal,
        });
        try {
            const result = await run.result;
            if (result.stopReason !== 'completed') {
                record.status = 'failed';
                record.error = `model review stopped: ${result.stopReason}`;
                return { status: 'failed', detail: `model review: ${result.stopReason}` };
            }
            const text = result.output.filter(block => block.type === 'text').map(block => block.text ?? '').join('\n').trim();
            if (text.length === 0) {
                record.status = 'failed';
                record.error = 'model review produced no output';
                return { status: 'failed', detail: 'model review produced no output' };
            }
            record.report = {
                findings: [],
                summary: `model review complete (provider ${provider})${truncated ? ' (diff truncated)' : ''}`,
                postBody: text,
                truncated,
            };
            record.status = 'completed';
            return { status: 'completed', detail: `model review (${provider})`, output: text };
        }
        finally {
            await run.dispose();
        }
    }
    catch (error) {
        const aborted = abortedOutcome(controller, cancelReason);
        if (aborted !== null) {
            record.status = aborted.status === 'killed' ? 'killed' : 'failed';
            return aborted;
        }
        record.status = 'failed';
        const message = error instanceof Error ? error.message : 'model review failed';
        record.error = message;
        return { status: 'failed', detail: message };
    }
}
/** One-line CI check summary: counts, pending, and failed. */
function summarizeChecks(runs) {
    if (runs.length === 0)
        return 'no checks reported';
    const pending = runs.filter(run => run.status !== 'completed').length;
    const failed = runs.filter(run => run.conclusion !== undefined && run.conclusion !== 'success' && run.conclusion !== 'neutral' && run.conclusion !== 'skipped').length;
    return `${runs.length} check(s), ${pending} pending, ${failed} failed`;
}
/** Terminal outcome for an aborted controller; null while still running. */
function abortedOutcome(controller, cancelReason) {
    if (!controller.signal.aborted)
        return null;
    if (cancelReason === 'timeout') {
        return { status: 'failed', detail: 'timeout' };
    }
    if (cancelReason !== undefined) {
        return { status: 'killed', detail: cancelReason };
    }
    return { status: 'failed', detail: 'aborted' };
}
//# sourceMappingURL=jobs.js.map