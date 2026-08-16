/**
 * The `ci_run` tool — the one-shot CI pipeline entry point used by the
 * composite action's headless session (and available in interactive sessions
 * where `ci.enabled` is on).
 *
 * Tasks:
 * - `review`: one deterministic pass — analyze, post comments (configurable),
 *   publish the status check, and write the JSON/Markdown reports.
 * - `analyze`: read-only preparation — returns the capped diff and static
 *   findings without any write, so a `model` engine can author its own body.
 * - `publish`: post the (optionally model-authored) review and the check.
 *
 * Every write is gated by the same `tools/pre-execute` approval gate as the
 * other tools: interactive sessions ask the human; the CI driver
 * (`DSH_GITHUB_CI_DRIVER=1`) auto-allows exactly the actions listed in
 * `ci.autoApprove`.
 * @module dsh-github/ci/tool
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { errorValue } from "../tools.js";
import { ERROR_SCHEMA, RATE_LIMIT_SCHEMA } from "../tools.js";
import { ciRunCall, ciRunResult } from "../present.js";
import { identityMeta } from "../present.js";
import { runCiPipeline } from "./pipeline.js";
const FINDING_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        file: { type: 'string', required: true },
        line: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
        severity: { type: 'string', required: true, enum: ['info', 'warning', 'error'] },
        rule: { type: 'string', required: true },
        message: { type: 'string', required: true },
    },
};
const TASKS = ['review', 'analyze', 'publish'];
/** `ci_run`: run one CI review pass (write; approval-gated upstream). */
export function ciRunTool(state) {
    return defineTool({
        name: 'ci_run',
        description: 'Run one dsh-github CI pass over a pull request. task "review" analyzes the diff, posts inline '
            + 'review comments, publishes the status check, and writes dsh-github-ci-result.json / dsh-github-ci-summary.md. '
            + 'task "analyze" returns the capped diff and static findings without writing anything (read-only), so you can '
            + 'author the review yourself. task "publish" posts your review `body`/`findings` and the check. Repeated runs '
            + 'for the same head commit are idempotent (comments and checks are not duplicated). Requires approval unless '
            + 'auto-approved by the CI driver configuration.',
        parameters: {
            task: { type: 'string', required: true, enum: [...TASKS], description: 'Which CI pass to run.' },
            pr: { type: 'string', required: true, description: 'PR number, #number, owner/repo#number, or pull URL.' },
            ownerRepo: { type: 'string', description: 'Repository as owner/repo. Defaults to configured or git origin.' },
            maxDiffChars: { type: 'number', description: 'Cap for the diff text. Defaults to the plugin config.' },
            body: { type: 'string', description: 'Review-body override (publish task).' },
            findings: { type: 'array', items: FINDING_SCHEMA, description: 'Extra findings authored by you (publish task).' },
            postComments: { type: 'boolean', description: 'Post review comments. Defaults to the ci.postComments config.' },
            postCheck: { type: 'boolean', description: 'Publish the status check. Defaults to true.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            status: { type: 'string', required: true, const: 'ok' },
                            repo: { type: 'string', required: true },
                            pr: { type: 'integer', required: true },
                            headSha: { type: 'string', required: true },
                            verdict: { type: 'string', required: true, enum: ['pass', 'needs-changes', 'skipped'] },
                            engine: { type: 'string', required: true, enum: ['static', 'model'] },
                            findings: { type: 'array', items: FINDING_SCHEMA },
                            summary: { type: 'string', required: true },
                            truncated: { type: 'boolean', required: true },
                            alreadyReviewed: { type: 'boolean', required: true },
                            diffText: { type: 'string' },
                            checkRun: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    id: { type: 'integer', required: true },
                                    url: { type: 'string', required: true },
                                    conclusion: { type: 'string', required: true },
                                },
                            },
                            review: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    url: { type: 'string', required: true },
                                    inlineComments: { type: 'integer', required: true },
                                },
                            },
                            files: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    json: { type: 'string', required: true },
                                    markdown: { type: 'string', required: true },
                                },
                            },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (args, value) => {
                if (value.status === 'error') {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                const lines = [`CI ${args.task}: PR #${value.pr} (${value.repo}) verdict ${value.verdict}`, value.summary];
                if (value.checkRun !== undefined)
                    lines.push(`check: ${value.checkRun.url} (${value.checkRun.conclusion})`);
                if (value.review !== undefined && value.review.url.length > 0)
                    lines.push(`review: ${value.review.url}`);
                if (value.files !== undefined)
                    lines.push(`reports: ${value.files.json} · ${value.files.markdown}`);
                if (value.diffText !== undefined)
                    lines.push(`diff (${value.diffText.length} chars${value.truncated ? ', truncated' : ''}):\n${value.diffText}`);
                return [{ type: 'text', text: lines.join('\n') }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => false,
        presentCall: ciRunCall,
        presentResult: ciRunResult,
        async execute(args, exec) {
            const ref = state.parsePrRef(args.pr);
            if (ref === null)
                return errorValue('invalid-pr', `"${args.pr}" is not a PR reference`, 'Use a number, "#number", "owner/repo#number", or a pull URL.');
            const repoResult = ref.repo !== undefined ? { ok: true, repo: ref.repo } : await state.resolveRepo(undefined, exec.signal);
            if (!repoResult.ok)
                return errorValue(repoResult.code, repoResult.message, repoResult.guidance);
            const findings = args.findings?.map(finding => ({
                file: String(finding.file),
                line: finding.line ?? null,
                severity: finding.severity,
                rule: String(finding.rule),
                message: String(finding.message),
            })) ?? [];
            const outcome = await runCiPipeline(state, {
                repo: repoResult.repo,
                pr: ref.number,
                task: args.task,
                ...args.maxDiffChars !== undefined && args.maxDiffChars > 0 ? { maxDiffChars: Math.floor(args.maxDiffChars) } : {},
                ...args.body !== undefined ? { body: args.body } : {},
                ...findings.length > 0 ? { findings } : {},
                ...args.postComments !== undefined ? { postComments: args.postComments } : {},
                ...args.postCheck !== undefined ? { postCheck: args.postCheck } : {},
                signal: exec.signal,
            });
            if (outcome.status === 'error') {
                return errorValue(outcome.code, outcome.message, outcome.guidance, outcome.rateLimit !== undefined ? outcome.rateLimit : undefined);
            }
            return outcome;
        },
    });
}
//# sourceMappingURL=tool.js.map