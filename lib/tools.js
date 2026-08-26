/**
 * The model-facing tool surface of dsh-github.
 *
 * Twelve tools: pr_create / pr_merge / pr_update / review_post / issue_open /
 * issue_comment / issue_close (writes, approval-gated by the tools/pre-execute
 * listener in approval-gate.ts) and gh_review / gh_issue / gh_search / gh_repo /
 * gh_file (concurrency-safe reads). Every execute returns only the canonical
 * JSON value declared by its output schema; infrastructure failures throw so
 * the registry marks them isError. Tokens never appear in canonical values,
 * rendered content, or thrown messages. Rate-limit facts ride every result,
 * including errors.
 * @module dsh-github/tools
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { GithubError } from "./github.js";
import { readGitState } from "./git.js";
import { analyzeDiff, formatPostBody, parseDiffStats } from "./review.js";
import { rateLimitValue } from "./state.js";
import { ghFileCall, ghFileResult, ghIssueCall, ghIssueResult, ghRepoCall, ghRepoResult, ghReviewCall, ghReviewResult, ghSearchCall, ghSearchResult, identityMeta, issueCloseCall, issueCloseResult, issueCommentCall, issueCommentResult, issueOpenCall, issueOpenResult, prCreateCall, prCreateResult, prMergeCall, prMergeResult, prUpdateCall, prUpdateResult, reviewPostCall, reviewPostResult, } from "./present.js";
const RATE_LIMIT_PROPERTIES = {
    remaining: { oneOf: [{ type: 'number' }, { type: 'null' }] },
    resetAt: { oneOf: [{ type: 'number' }, { type: 'null' }] },
};
export const RATE_LIMIT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: RATE_LIMIT_PROPERTIES,
    required: true,
};
export const ERROR_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        status: { type: 'string', required: true, const: 'error' },
        code: { type: 'string', required: true },
        message: { type: 'string', required: true },
        guidance: { type: 'string' },
        rateLimit: {
            type: 'object',
            additionalProperties: false,
            properties: RATE_LIMIT_PROPERTIES,
        },
    },
};
/** Domain error canonical value, used by every tool. */
export function errorValue(code, message, guidance, rateLimit) {
    return { status: 'error', code, message, ...guidance !== undefined ? { guidance } : {}, ...rateLimit !== undefined ? { rateLimit } : {} };
}
/** Convert a GitHub API failure to the error variant; rethrow the rest. */
function githubErrorValue(error) {
    if (error instanceof GithubError) {
        return errorValue('github-api', `GitHub API ${error.status}: ${error.message}`, undefined, {
            remaining: error.rateLimit.remaining,
            resetAt: error.rateLimit.resetAt,
        });
    }
    throw error;
}
/** Stable code for a failed supplementary section fetch. */
function sectionErrorCode(error) {
    if (error instanceof GithubError)
        return `github-api-${error.status}`;
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted')))
        return 'aborted';
    return 'fetch-failed';
}
/** Cap text to `maxChars` characters and report the truncation. */
function capText(text, maxChars) {
    return text.length > maxChars ? { text: text.slice(0, maxChars), truncated: true } : { text, truncated: false };
}
/** First line of a text block, for comment-item titles. */
function firstLineOf(text) {
    return text.split('\n')[0] ?? '';
}
/** Fields gh_review can select; omitted means all. */
const REVIEW_FIELDS = ['metadata', 'diff', 'comments', 'ci', 'findings'];
/** `pr_create`: create a pull request (write; approval-gated upstream). */
export function prCreateTool(state) {
    return defineTool({
        name: 'pr_create',
        description: 'Create a GitHub pull request. Requires approval. Does NOT commit or push local changes — '
            + 'commit and push via bash first when the head branch is not on the remote. Returns the PR URL and number.',
        parameters: {
            title: { type: 'string', required: true, description: 'PR title.' },
            body: { type: 'string', description: 'PR description body.' },
            base: { type: 'string', description: 'Target branch. Defaults to the repository default branch.' },
            head: { type: 'string', description: 'Source branch. Defaults to the current git branch.' },
            draft: { type: 'boolean', description: 'Create as a draft PR.' },
            ownerRepo: { type: 'string', description: 'Target repository as owner/repo. Defaults to configured or git origin.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            status: { type: 'string', required: true, const: 'created' },
                            url: { type: 'string', required: true },
                            number: { type: 'integer', required: true },
                            title: { type: 'string', required: true },
                            state: { type: 'string', required: true },
                            draft: { type: 'boolean', required: true },
                            base: { type: 'string', required: true },
                            head: { type: 'string', required: true },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if (value.status === 'error') {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                return [{ type: 'text', text: `created pull request #${value.number}: ${value.url} (${value.base} ← ${value.head}${value.draft ? ', draft' : ''})` }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => false,
        presentCall: prCreateCall,
        presentResult: prCreateResult,
        async execute(args, exec) {
            if (args.title.trim().length === 0)
                return errorValue('invalid-args', 'title must not be empty');
            const repo = await state.resolveRepo(args.ownerRepo, exec.signal);
            if (!repo.ok)
                return errorValue(repo.code, repo.message, repo.guidance);
            let head = args.head?.trim();
            if (head === undefined || head.length === 0) {
                const git = await readGitState(state.workspaceDir, state.runGit, exec.signal, state.apiHost);
                if (git.branch === null)
                    return errorValue('no-head', 'could not determine the head branch', 'Pass `head` explicitly or run inside a git checkout.');
                if (git.branch === 'HEAD') {
                    return errorValue('no-head', 'the checkout is in detached HEAD state', 'Check out a branch (or pass `head` explicitly) before creating a pull request.');
                }
                head = git.branch;
            }
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            const client = state.client(token.token.value);
            let base = args.base?.trim();
            if (base === undefined || base.length === 0) {
                try {
                    const repoInfo = await client.requestJson('GET', `/repos/${repo.repo}`, { signal: exec.signal });
                    base = repoInfo.data.default_branch;
                    if (base === undefined || base.length === 0)
                        return errorValue('no-base', 'the repository reports no default branch', 'Pass `base` explicitly.');
                }
                catch (error) {
                    return githubErrorValue(error);
                }
            }
            try {
                const created = await client.requestJson('POST', `/repos/${repo.repo}/pulls`, {
                    signal: exec.signal,
                    body: {
                        title: args.title,
                        ...args.body !== undefined ? { body: args.body } : {},
                        head,
                        base,
                        draft: args.draft === true,
                    },
                });
                const data = created.data;
                return {
                    status: 'created',
                    url: data.html_url,
                    number: data.number,
                    title: data.title,
                    state: data.state,
                    draft: data.draft === true,
                    base: data.base?.ref ?? base,
                    head: data.head?.ref ?? head,
                    rateLimit: rateLimitValue(created.rateLimit),
                };
            }
            catch (error) {
                return githubErrorValue(error);
            }
        },
    });
}
/** `gh_review`: read a PR's metadata, diff, comments, CI, and findings. */
export function ghReviewTool(state) {
    return defineTool({
        name: 'gh_review',
        description: 'Read a GitHub pull request: metadata, unified diff, review comments, CI check status, and '
            + 'static-analysis findings. Read-only and concurrency-safe. `pr` accepts a number, "#number", '
            + '"owner/repo#number", or a pull-request URL. Section fetch failures are reported per section '
            + '(diff.error / comments.error / ci.error); the rest of the summary stays intact.',
        parameters: {
            pr: { type: 'string', required: true, description: 'PR number, #number, owner/repo#number, or pull URL.' },
            fields: { type: 'array', items: { type: 'string', enum: [...REVIEW_FIELDS] }, description: 'Sections to fetch. Omit for all.' },
            maxDiffChars: { type: 'number', description: 'Cap for the diff text. Defaults to the plugin config.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            repo: { type: 'string', required: true },
                            number: { type: 'integer', required: true },
                            title: { type: 'string', required: true },
                            state: { type: 'string', required: true },
                            author: { type: 'string', required: true },
                            url: { type: 'string', required: true },
                            additions: { type: 'integer', required: true },
                            deletions: { type: 'integer', required: true },
                            base: { type: 'string', required: true },
                            head: { type: 'string', required: true },
                            ci: {
                                type: 'object',
                                additionalProperties: false,
                                required: true,
                                properties: {
                                    summary: { type: 'string', required: true },
                                    status: { type: 'string' },
                                    conclusion: { type: 'string' },
                                    error: { type: 'string' },
                                    runs: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            additionalProperties: false,
                                            properties: {
                                                name: { type: 'string', required: true },
                                                status: { type: 'string', required: true },
                                                conclusion: { type: 'string' },
                                            },
                                        },
                                    },
                                },
                            },
                            comments: {
                                type: 'object',
                                additionalProperties: false,
                                required: true,
                                properties: {
                                    items: {
                                        type: 'array',
                                        required: true,
                                        items: {
                                            type: 'object',
                                            additionalProperties: false,
                                            properties: {
                                                id: { type: 'integer', required: true },
                                                user: { type: 'string', required: true },
                                                path: { type: 'string' },
                                                line: { type: 'integer' },
                                                body: { type: 'string', required: true },
                                            },
                                        },
                                    },
                                    error: { type: 'string' },
                                },
                            },
                            findings: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        file: { type: 'string', required: true },
                                        line: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
                                        severity: { type: 'string', required: true, enum: ['info', 'warning', 'error'] },
                                        rule: { type: 'string', required: true },
                                        message: { type: 'string', required: true },
                                    },
                                },
                            },
                            diff: {
                                type: 'object',
                                additionalProperties: false,
                                required: true,
                                properties: {
                                    length: { type: 'integer', required: true },
                                    truncated: { type: 'boolean', required: true },
                                    excerpt: { type: 'string', required: true },
                                    text: { type: 'string', required: true },
                                    error: { type: 'string' },
                                    files: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            additionalProperties: false,
                                            properties: {
                                                path: { type: 'string', required: true },
                                                added: { type: 'integer', required: true },
                                                removed: { type: 'integer', required: true },
                                            },
                                        },
                                    },
                                },
                            },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if ('status' in value) {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                return renderPrSummary(value);
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => true,
        presentCall: ghReviewCall,
        presentResult: ghReviewResult,
        async execute(args, exec) {
            const ref = state.parsePrRef(args.pr);
            if (ref === null)
                return errorValue('invalid-pr', `"${args.pr}" is not a PR reference`, 'Use a number, "#number", "owner/repo#number", or a pull URL.');
            const repoResult = ref.repo !== undefined ? { ok: true, repo: ref.repo } : await state.resolveRepo(undefined, exec.signal);
            if (!repoResult.ok)
                return errorValue(repoResult.code, repoResult.message, repoResult.guidance);
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            const client = state.client(token.token.value);
            const fields = new Set(args.fields ?? REVIEW_FIELDS);
            const maxDiffChars = args.maxDiffChars !== undefined && args.maxDiffChars > 0 ? Math.floor(args.maxDiffChars) : state.config.maxDiffChars;
            let payload;
            let rateLimit;
            try {
                const metadataResponse = await client.requestJson('GET', `/repos/${repoResult.repo}/pulls/${ref.number}`, { signal: exec.signal });
                payload = metadataResponse.data;
                rateLimit = rateLimitValue(metadataResponse.rateLimit);
            }
            catch (error) {
                return githubErrorValue(error);
            }
            let diffText = '';
            let diffTruncated = false;
            let diffError;
            if (fields.has('diff') || fields.has('findings')) {
                try {
                    const capped = capText((await client.requestText('GET', `/repos/${repoResult.repo}/pulls/${ref.number}`, { signal: exec.signal })).text, maxDiffChars);
                    diffText = capped.text;
                    diffTruncated = capped.truncated;
                }
                catch (error) {
                    diffError = sectionErrorCode(error);
                }
            }
            let comments = [];
            let commentsError;
            if (fields.has('comments')) {
                try {
                    comments = (await client.requestJson('GET', `/repos/${repoResult.repo}/pulls/${ref.number}/comments?per_page=${state.config.maxComments}`, { signal: exec.signal })).data;
                }
                catch (error) {
                    commentsError = sectionErrorCode(error);
                }
            }
            let ci = { summary: 'unknown' };
            if (fields.has('ci')) {
                try {
                    const runs = (await client.requestJson('GET', `/repos/${repoResult.repo}/commits/${payload.head?.sha ?? ''}/check-runs`, { signal: exec.signal })).data.check_runs ?? [];
                    ci = summarizeChecks(runs);
                }
                catch (error) {
                    ci = { summary: 'unknown', error: sectionErrorCode(error) };
                }
            }
            const findings = fields.has('findings')
                ? analyzeDiff(diffText, maxDiffChars, { maxFindings: state.config.maxFindings, maxLineLength: state.config.maxLineLength }).findings
                : [];
            const value = {
                repo: repoResult.repo,
                number: payload.number,
                title: payload.title,
                state: payload.state,
                author: payload.user?.login ?? 'unknown',
                url: payload.html_url,
                additions: payload.additions,
                deletions: payload.deletions,
                base: payload.base?.ref ?? '',
                head: payload.head?.ref ?? '',
                ci,
                comments: {
                    items: comments.map(comment => ({
                        id: comment.id,
                        user: comment.user?.login ?? 'unknown',
                        ...comment.path !== null && comment.path !== undefined ? { path: comment.path } : {},
                        ...comment.line !== null && comment.line !== undefined ? { line: comment.line } : {},
                        body: comment.body ?? '',
                    })),
                    ...commentsError !== undefined ? { error: commentsError } : {},
                },
                findings: findings.map(finding => ({ ...finding })),
                diff: {
                    length: diffText.length,
                    truncated: diffTruncated,
                    excerpt: diffText.slice(0, state.config.renderExcerptChars),
                    text: diffText,
                    files: diffError !== undefined ? [] : parseDiffStats(diffText, maxDiffChars),
                    ...diffError !== undefined ? { error: diffError } : {},
                },
                rateLimit,
            };
            return value;
        },
    });
}
function renderPrSummary(value) {
    const findings = value.findings ?? [];
    const commentItems = value.comments?.items ?? [];
    const files = value.diff.files ?? [];
    const lines = [
        `PR #${value.number} "${value.title}" (${value.state}) by ${value.author}`,
        `${value.repo} · ${value.base} ← ${value.head} · +${value.additions} −${value.deletions} · ${value.url}`,
        `CI: ${value.ci.summary}${value.ci.error !== undefined ? ` (unavailable: ${value.ci.error})` : ''}`,
        `Comments (external GitHub content): ${commentItems.length} review comment(s); static findings: ${findings.length}`,
    ];
    if (value.comments?.error !== undefined)
        lines.push(`Comment fetch failed: ${value.comments.error}`);
    for (const finding of findings.slice(0, 10)) {
        lines.push(`- [${finding.severity}] ${finding.rule} ${finding.file}${finding.line !== null && finding.line !== undefined ? `:${finding.line}` : ''}: ${finding.message}`);
    }
    if (findings.length > 10)
        lines.push(`… ${findings.length - 10} more findings`);
    lines.push(`Diff: ${value.diff.length} chars${value.diff.truncated ? ' (truncated)' : ''} across ${files.length} file(s)${value.diff.error !== undefined ? ` (unavailable: ${value.diff.error})` : ''}`);
    if (value.diff.excerpt.length > 0)
        lines.push(`Diff excerpt:\n${value.diff.excerpt}`);
    if (value.rateLimit?.remaining !== null && value.rateLimit?.remaining !== undefined)
        lines.push(`GitHub rate limit remaining: ${value.rateLimit.remaining}`);
    return [{ type: 'text', text: lines.join('\n') }];
}
function summarizeChecks(runs) {
    const normalized = runs.map(run => ({
        name: run.name ?? 'unnamed check',
        status: run.status ?? 'unknown',
        ...run.conclusion !== null && run.conclusion !== undefined ? { conclusion: run.conclusion } : {},
    }));
    if (normalized.length === 0)
        return { summary: 'no checks reported' };
    const pending = normalized.filter(run => run.status !== 'completed').length;
    const failed = normalized.filter(run => run.conclusion !== undefined && run.conclusion !== 'success' && run.conclusion !== 'neutral' && run.conclusion !== 'skipped').length;
    const status = pending > 0 ? 'in-progress' : 'completed';
    const conclusion = pending > 0 ? undefined : failed > 0 ? 'failure' : 'success';
    return { summary: `${normalized.length} check(s), ${pending} pending, ${failed} failed`, status, ...conclusion !== undefined ? { conclusion } : {}, runs: normalized };
}
/** `review_post`: publish a review job's drafted comment (write; approval-gated upstream). */
export function reviewPostTool(state) {
    return defineTool({
        name: 'review_post',
        description: 'Post the review comment drafted by a completed background review job (started with /review). '
            + 'Requires approval. mode "summary" posts one PR issue-level comment (default); mode "inline" posts a '
            + 'line-anchored review against the PR head commit. Pass `body` to override the drafted comment.',
        parameters: {
            jobId: { type: 'string', required: true, description: 'Id of a completed review job.' },
            mode: { type: 'string', enum: ['summary', 'inline'], description: 'Posting mode. Defaults to summary.' },
            body: { type: 'string', description: 'Override the drafted comment body.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            status: { type: 'string', required: true, const: 'posted' },
                            mode: { type: 'string', required: true, enum: ['summary', 'inline'] },
                            url: { type: 'string', required: true },
                            commentId: { type: 'integer' },
                            reviewId: { type: 'integer' },
                            findings: { type: 'integer', required: true },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if (value.status === 'error')
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                return value.mode === 'inline'
                    ? [{ type: 'text', text: `posted inline review with ${value.findings} finding(s): ${value.url}` }]
                    : [{ type: 'text', text: `posted review comment with ${value.findings} finding(s): ${value.url}` }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => false,
        presentCall: reviewPostCall,
        presentResult: reviewPostResult,
        async execute(args, exec) {
            const record = state.records.get(args.jobId);
            if (record === undefined)
                return errorValue('unknown-job', `no review job "${args.jobId}"`, 'List jobs with job_list and pick a github-review job id.');
            if (record.status !== 'completed' || record.report === null) {
                return errorValue('job-not-completed', `review job "${args.jobId}" has not completed`, 'Wait for the completion notice, then post.');
            }
            const mode = args.mode ?? 'summary';
            const override = args.body !== undefined ? args.body.trim() : '';
            if (args.body !== undefined && override.length === 0)
                return errorValue('invalid-args', 'body must not be empty');
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            const client = state.client(token.token.value);
            const findings = record.report.findings;
            try {
                if (mode === 'inline') {
                    if (record.headSha === undefined) {
                        return errorValue('no-head-sha', `review job "${args.jobId}" has no head commit captured`, 'Re-run /review for this PR; inline comments need the head-commit SHA.');
                    }
                    const inline = findings.filter(finding => finding.line !== null);
                    const rest = findings.filter(finding => finding.line === null);
                    const reviewBody = override.length > 0 ? override : formatPostBody(rest, record.report.truncated);
                    const posted = await client.requestJson('POST', `/repos/${record.repo}/pulls/${record.pr}/reviews`, {
                        signal: exec.signal,
                        body: {
                            body: reviewBody,
                            event: 'COMMENT',
                            // A body-only review omits `comments` entirely: GitHub rejects
                            // an empty array edge more strictly than a missing key.
                            ...inline.length > 0 ? {
                                comments: inline.map(finding => ({
                                    path: finding.file,
                                    line: finding.line,
                                    body: `**${finding.severity}** \`${finding.rule}\`: ${finding.message}`,
                                })),
                            } : {},
                        },
                    });
                    return { status: 'posted', mode: 'inline', url: posted.data.html_url, reviewId: posted.data.id, findings: findings.length, rateLimit: rateLimitValue(posted.rateLimit) };
                }
                const posted = await client.requestJson('POST', `/repos/${record.repo}/issues/${record.pr}/comments`, { signal: exec.signal, body: { body: override.length > 0 ? override : record.report.postBody } });
                return { status: 'posted', mode: 'summary', url: posted.data.html_url, commentId: posted.data.id, findings: findings.length, rateLimit: rateLimitValue(posted.rateLimit) };
            }
            catch (error) {
                return githubErrorValue(error);
            }
        },
    });
}
/** `gh_issue`: read issues (list / get / comments). Read-only. */
export function ghIssueTool(state) {
    return defineTool({
        name: 'gh_issue',
        description: 'Read GitHub issues. `action`: "list" repository issues (filter by state; pull requests are '
            + 'marked with kind "pr"), "get" one issue by number, or "comments" for one issue\'s comments. Read-only '
            + 'and concurrency-safe. Use issue_open to create.',
        parameters: {
            action: { type: 'string', required: true, enum: ['list', 'get', 'comments'], description: 'Which read to perform.' },
            ownerRepo: { type: 'string', description: 'Repository as owner/repo. Defaults to configured or git origin.' },
            issueNumber: { type: 'integer', description: 'Issue number; required for get and comments.' },
            state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Filter for list. Defaults to open.' },
            limit: { type: 'integer', description: 'Max items for list. Defaults to 30, capped at 100.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            repo: { type: 'string', required: true },
                            action: { type: 'string', required: true, enum: ['list', 'get', 'comments'] },
                            total: { type: 'integer', required: true },
                            items: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        number: { type: 'integer', required: true },
                                        title: { type: 'string', required: true },
                                        state: { type: 'string', required: true },
                                        kind: { type: 'string', required: true, enum: ['issue', 'pr', 'comment'] },
                                        author: { type: 'string', required: true },
                                        url: { type: 'string', required: true },
                                        comments: { type: 'integer', required: true },
                                        createdAt: { type: 'string', required: true },
                                        body: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                                    },
                                },
                            },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if ('status' in value) {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                return [{
                        type: 'text',
                        text: (value.items ?? []).length === 0
                            ? `no issues in ${value.repo}`
                            : (value.items ?? []).map(item => `#${item.number} ${item.title} [${item.kind}/${item.state}] by ${item.author} — ${item.url}`).join('\n'),
                    }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => true,
        presentCall: ghIssueCall,
        presentResult: ghIssueResult,
        async execute(args, exec) {
            if ((args.action === 'get' || args.action === 'comments') && args.issueNumber === undefined) {
                return errorValue('invalid-args', `action "${args.action}" requires issueNumber`);
            }
            const repoResult = await state.resolveRepo(args.ownerRepo, exec.signal);
            if (!repoResult.ok)
                return errorValue(repoResult.code, repoResult.message, repoResult.guidance);
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            const client = state.client(token.token.value);
            let raw = [];
            let rawComments = null;
            let rateLimit = { remaining: null, resetAt: null };
            try {
                if (args.action === 'list') {
                    const limit = Math.min(Math.max(args.limit ?? 30, 1), 100);
                    const listResponse = await client.requestJson('GET', `/repos/${repoResult.repo}/issues?state=${args.state ?? 'open'}&per_page=${limit}`, { signal: exec.signal });
                    raw = listResponse.data;
                    rateLimit = rateLimitValue(listResponse.rateLimit);
                }
                else if (args.action === 'comments') {
                    const number = args.issueNumber;
                    const commentsResponse = await client.requestJson('GET', `/repos/${repoResult.repo}/issues/${number}/comments`, { signal: exec.signal });
                    rawComments = commentsResponse.data;
                    rateLimit = rateLimitValue(commentsResponse.rateLimit);
                }
                else {
                    const number = args.issueNumber;
                    const oneResponse = await client.requestJson('GET', `/repos/${repoResult.repo}/issues/${number}`, { signal: exec.signal });
                    raw = [oneResponse.data];
                    rateLimit = rateLimitValue(oneResponse.rateLimit);
                }
            }
            catch (error) {
                return githubErrorValue(error);
            }
            const items = rawComments !== null
                ? rawComments.map(comment => ({
                    number: comment.id,
                    title: firstLineOf(comment.body ?? '').slice(0, 80),
                    state: 'comment',
                    kind: 'comment',
                    author: comment.user?.login ?? 'unknown',
                    url: comment.html_url ?? '',
                    comments: 0,
                    createdAt: comment.created_at ?? '',
                    body: comment.body ?? null,
                }))
                : raw.map(item => ({
                    number: item.number,
                    title: item.title,
                    state: item.state,
                    kind: item.pull_request !== undefined ? 'pr' : 'issue',
                    author: item.user?.login ?? 'unknown',
                    url: item.html_url,
                    comments: item.comments ?? 0,
                    createdAt: item.created_at ?? '',
                    body: item.body ?? null,
                }));
            const value = {
                repo: repoResult.repo,
                action: args.action,
                total: items.length,
                items,
                rateLimit,
            };
            return value;
        },
    });
}
/** `issue_open`: create an issue (write; approval-gated upstream). */
export function issueOpenTool(state) {
    return defineTool({
        name: 'issue_open',
        description: 'Create a GitHub issue. Requires approval. Returns the issue URL and number.',
        parameters: {
            title: { type: 'string', required: true, description: 'Issue title.' },
            body: { type: 'string', description: 'Issue body.' },
            labels: { type: 'array', items: { type: 'string' }, description: 'Label names to apply.' },
            ownerRepo: { type: 'string', description: 'Target repository as owner/repo. Defaults to configured or git origin.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            status: { type: 'string', required: true, const: 'created' },
                            url: { type: 'string', required: true },
                            number: { type: 'integer', required: true },
                            title: { type: 'string', required: true },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if (value.status === 'error') {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                return [{ type: 'text', text: `created issue #${value.number}: ${value.url}` }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => false,
        presentCall: issueOpenCall,
        presentResult: issueOpenResult,
        async execute(args, exec) {
            if (args.title.trim().length === 0)
                return errorValue('invalid-args', 'title must not be empty');
            const repo = await state.resolveRepo(args.ownerRepo, exec.signal);
            if (!repo.ok)
                return errorValue(repo.code, repo.message, repo.guidance);
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            try {
                const created = await state.client(token.token.value).requestJson('POST', `/repos/${repo.repo}/issues`, {
                    signal: exec.signal,
                    body: {
                        title: args.title,
                        ...args.body !== undefined ? { body: args.body } : {},
                        ...args.labels !== undefined && args.labels.length > 0 ? { labels: args.labels } : {},
                    },
                });
                return { status: 'created', url: created.data.html_url, number: created.data.number, title: created.data.title, rateLimit: rateLimitValue(created.rateLimit) };
            }
            catch (error) {
                return githubErrorValue(error);
            }
        },
    });
}
/** `issue_comment`: comment on an issue or pull request (write; approval-gated upstream). */
export function issueCommentTool(state) {
    return defineTool({
        name: 'issue_comment',
        description: 'Comment on a GitHub issue or pull request. Requires approval. Returns the comment URL.',
        parameters: {
            ownerRepo: { type: 'string', description: 'Repository as owner/repo. Defaults to configured or git origin.' },
            issueNumber: { type: 'integer', required: true, description: 'Issue or pull request number.' },
            body: { type: 'string', required: true, description: 'Comment body.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            status: { type: 'string', required: true, const: 'commented' },
                            url: { type: 'string', required: true },
                            commentId: { type: 'integer', required: true },
                            issueNumber: { type: 'integer', required: true },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if (value.status === 'error') {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                return [{ type: 'text', text: `commented on #${value.issueNumber}: ${value.url}` }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => false,
        presentCall: issueCommentCall,
        presentResult: issueCommentResult,
        async execute(args, exec) {
            const body = args.body.trim();
            if (body.length === 0)
                return errorValue('invalid-args', 'body must not be empty');
            const repo = await state.resolveRepo(args.ownerRepo, exec.signal);
            if (!repo.ok)
                return errorValue(repo.code, repo.message, repo.guidance);
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            try {
                const posted = await state.client(token.token.value).requestJson('POST', `/repos/${repo.repo}/issues/${args.issueNumber}/comments`, { signal: exec.signal, body: { body } });
                return { status: 'commented', url: posted.data.html_url, commentId: posted.data.id, issueNumber: args.issueNumber, rateLimit: rateLimitValue(posted.rateLimit) };
            }
            catch (error) {
                return githubErrorValue(error);
            }
        },
    });
}
/** `issue_close`: close an issue (write; approval-gated upstream). */
export function issueCloseTool(state) {
    return defineTool({
        name: 'issue_close',
        description: 'Close a GitHub issue. Requires approval. Optionally records a close reason '
            + '("completed" or "not planned") for projects that surface it.',
        parameters: {
            ownerRepo: { type: 'string', description: 'Repository as owner/repo. Defaults to configured or git origin.' },
            issueNumber: { type: 'integer', required: true, description: 'Issue number.' },
            stateReason: { type: 'string', enum: ['completed', 'not_planned'], description: 'Close reason GitHub records. Omit for a plain close.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            status: { type: 'string', required: true, const: 'closed' },
                            url: { type: 'string', required: true },
                            number: { type: 'integer', required: true },
                            title: { type: 'string', required: true },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if (value.status === 'error') {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                return [{ type: 'text', text: `closed issue #${value.number}: ${value.url}` }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => false,
        presentCall: issueCloseCall,
        presentResult: issueCloseResult,
        async execute(args, exec) {
            const repo = await state.resolveRepo(args.ownerRepo, exec.signal);
            if (!repo.ok)
                return errorValue(repo.code, repo.message, repo.guidance);
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            try {
                const closed = await state.client(token.token.value).requestJson('PATCH', `/repos/${repo.repo}/issues/${args.issueNumber}`, {
                    signal: exec.signal,
                    body: {
                        state: 'closed',
                        ...args.stateReason !== undefined ? { state_reason: args.stateReason } : {},
                    },
                });
                return { status: 'closed', url: closed.data.html_url, number: closed.data.number, title: closed.data.title, rateLimit: rateLimitValue(closed.rateLimit) };
            }
            catch (error) {
                return githubErrorValue(error);
            }
        },
    });
}
const SEARCH_REPO_RE = /https?:\/\/[^/]+\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/(?:issues|pull)\/\d+/;
/** `gh_search`: search issues and pull requests (read; uses the search quota). */
export function ghSearchTool(state) {
    return defineTool({
        name: 'gh_search',
        description: 'Search GitHub issues and pull requests (GitHub search syntax, e.g. "repo:owner/name is:issue crash"). '
            + 'Read-only and concurrency-safe. Uses the separate search-API quota.',
        parameters: {
            q: { type: 'string', required: true, description: 'Search query in GitHub search syntax.' },
            sort: { type: 'string', enum: ['comments', 'reactions', 'created', 'updated'], description: 'Sort key. Defaults to best match.' },
            order: { type: 'string', enum: ['desc', 'asc'], description: 'Sort order. Defaults to desc.' },
            perPage: { type: 'integer', description: 'Max results. Defaults to 20, capped at 100.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            query: { type: 'string', required: true },
                            total: { type: 'integer', required: true },
                            items: {
                                type: 'array',
                                required: true,
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        number: { type: 'integer', required: true },
                                        title: { type: 'string', required: true },
                                        state: { type: 'string', required: true },
                                        kind: { type: 'string', required: true, enum: ['issue', 'pr'] },
                                        author: { type: 'string', required: true },
                                        url: { type: 'string', required: true },
                                        repo: { type: 'string', required: true },
                                        comments: { type: 'integer', required: true },
                                        createdAt: { type: 'string', required: true },
                                    },
                                },
                            },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if ('status' in value) {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                if (value.items.length === 0)
                    return [{ type: 'text', text: `no results for "${value.query}"` }];
                return [{
                        type: 'text',
                        text: value.items.map(item => `#${item.number} ${item.title} [${item.kind}/${item.state}] ${item.repo} by ${item.author} — ${item.url}`).join('\n'),
                    }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => true,
        presentCall: ghSearchCall,
        presentResult: ghSearchResult,
        async execute(args, exec) {
            const q = args.q.trim();
            if (q.length === 0)
                return errorValue('invalid-args', 'q must not be empty');
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            const perPage = Math.min(Math.max(args.perPage ?? 20, 1), 100);
            const query = new URLSearchParams({ q, per_page: String(perPage) });
            if (args.sort !== undefined)
                query.set('sort', args.sort);
            if (args.order !== undefined)
                query.set('order', args.order);
            try {
                const response = await state.client(token.token.value).requestJson('GET', `/search/issues?${query.toString()}`, { signal: exec.signal });
                const items = response.data.items ?? [];
                const value = {
                    query: q,
                    total: response.data.total_count ?? items.length,
                    items: items.map(item => {
                        const match = SEARCH_REPO_RE.exec(item.html_url);
                        const isPr = item.pull_request !== undefined || item.html_url.includes('/pull/');
                        return {
                            number: item.number,
                            title: item.title,
                            state: item.state,
                            kind: isPr ? 'pr' : 'issue',
                            author: item.user?.login ?? 'unknown',
                            url: item.html_url,
                            repo: match?.[1] ?? '',
                            comments: item.comments ?? 0,
                            createdAt: item.created_at ?? '',
                        };
                    }),
                    rateLimit: rateLimitValue(response.rateLimit),
                };
                return value;
            }
            catch (error) {
                return githubErrorValue(error);
            }
        },
    });
}
/** `pr_merge`: merge a pull request (write; approval-gated upstream). */
export function prMergeTool(state) {
    return defineTool({
        name: 'pr_merge',
        description: 'Merge a GitHub pull request. Requires approval. `pr` accepts a number, "#number", '
            + '"owner/repo#number", or a pull-request URL. Optionally deletes the head branch after the merge.',
        parameters: {
            pr: { type: 'string', required: true, description: 'PR number, #number, owner/repo#number, or pull URL.' },
            mergeMethod: { type: 'string', enum: ['merge', 'squash', 'rebase'], description: 'Merge method. Defaults to merge.' },
            commitTitle: { type: 'string', description: 'Merge commit title (squash/rebase).' },
            commitMessage: { type: 'string', description: 'Merge commit message (squash/rebase).' },
            deleteBranch: { type: 'boolean', description: 'Delete the head branch after merging. Defaults to false.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            status: { type: 'string', required: true, const: 'merged' },
                            merged: { type: 'boolean', required: true },
                            sha: { type: 'string' },
                            message: { type: 'string', required: true },
                            url: { type: 'string', required: true },
                            branchDeleted: { type: 'boolean', required: true },
                            branchDeleteNote: { type: 'string' },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if (value.status === 'error') {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                const deleted = value.branchDeleted ? ' (head branch deleted)' : value.branchDeleteNote !== undefined ? ` (branch delete failed: ${value.branchDeleteNote})` : '';
                return [{ type: 'text', text: `merged pull request: ${value.url}${deleted} — ${value.message}` }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => false,
        presentCall: prMergeCall,
        presentResult: prMergeResult,
        async execute(args, exec) {
            const ref = state.parsePrRef(args.pr);
            if (ref === null)
                return errorValue('invalid-pr', `"${args.pr}" is not a PR reference`, 'Use a number, "#number", "owner/repo#number", or a pull URL.');
            const repoResult = ref.repo !== undefined ? { ok: true, repo: ref.repo } : await state.resolveRepo(undefined, exec.signal);
            if (!repoResult.ok)
                return errorValue(repoResult.code, repoResult.message, repoResult.guidance);
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            const client = state.client(token.token.value);
            let headRef;
            let headSha;
            let prUrl;
            try {
                const metadata = await client.requestJson('GET', `/repos/${repoResult.repo}/pulls/${ref.number}`, { signal: exec.signal });
                headRef = metadata.data.head?.ref;
                headSha = metadata.data.head?.sha;
                prUrl = metadata.data.html_url;
            }
            catch (error) {
                return githubErrorValue(error);
            }
            try {
                const merged = await client.requestJson('PUT', `/repos/${repoResult.repo}/pulls/${ref.number}/merge`, {
                    signal: exec.signal,
                    body: {
                        merge_method: args.mergeMethod ?? 'merge',
                        ...headSha !== undefined ? { sha: headSha } : {},
                        ...args.commitTitle !== undefined ? { commit_title: args.commitTitle } : {},
                        ...args.commitMessage !== undefined ? { commit_message: args.commitMessage } : {},
                    },
                });
                let branchDeleted = false;
                let branchDeleteNote;
                if (args.deleteBranch === true && headRef !== undefined && headRef.length > 0) {
                    try {
                        await client.requestJson('DELETE', `/repos/${repoResult.repo}/git/refs/${encodeURIComponent(`heads/${headRef}`)}`, { signal: exec.signal });
                        branchDeleted = true;
                    }
                    catch (error) {
                        branchDeleteNote = error instanceof GithubError ? `GitHub API ${error.status}` : 'delete failed';
                    }
                }
                return {
                    status: 'merged',
                    merged: merged.data.merged === true,
                    ...merged.data.sha !== undefined ? { sha: merged.data.sha } : {},
                    message: merged.data.message ?? 'merged',
                    url: prUrl,
                    branchDeleted,
                    ...branchDeleteNote !== undefined ? { branchDeleteNote } : {},
                    rateLimit: rateLimitValue(merged.rateLimit),
                };
            }
            catch (error) {
                return githubErrorValue(error);
            }
        },
    });
}
/** `pr_update`: edit a pull request (write; approval-gated upstream). */
export function prUpdateTool(state) {
    return defineTool({
        name: 'pr_update',
        description: 'Update a GitHub pull request: title, body, state (open/closed), or target branch. '
            + 'Requires approval. At least one field must be provided.',
        parameters: {
            pr: { type: 'string', required: true, description: 'PR number, #number, owner/repo#number, or pull URL.' },
            title: { type: 'string', description: 'New PR title.' },
            body: { type: 'string', description: 'New PR description body.' },
            state: { type: 'string', enum: ['open', 'closed'], description: 'New PR state.' },
            base: { type: 'string', description: 'New target branch.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            status: { type: 'string', required: true, const: 'updated' },
                            url: { type: 'string', required: true },
                            number: { type: 'integer', required: true },
                            title: { type: 'string', required: true },
                            state: { type: 'string', required: true },
                            base: { type: 'string', required: true },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if (value.status === 'error') {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                return [{ type: 'text', text: `updated pull request #${value.number} (${value.state}, base ${value.base}): ${value.url}` }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => false,
        presentCall: prUpdateCall,
        presentResult: prUpdateResult,
        async execute(args, exec) {
            if (args.title !== undefined && args.title.trim().length === 0)
                return errorValue('invalid-args', 'title must not be empty');
            if (args.base !== undefined && args.base.trim().length === 0)
                return errorValue('invalid-args', 'base must not be empty');
            if (args.title === undefined && args.body === undefined && args.state === undefined && args.base === undefined) {
                return errorValue('invalid-args', 'pass at least one of title, body, state, or base');
            }
            const ref = state.parsePrRef(args.pr);
            if (ref === null)
                return errorValue('invalid-pr', `"${args.pr}" is not a PR reference`, 'Use a number, "#number", "owner/repo#number", or a pull URL.');
            const repoResult = ref.repo !== undefined ? { ok: true, repo: ref.repo } : await state.resolveRepo(undefined, exec.signal);
            if (!repoResult.ok)
                return errorValue(repoResult.code, repoResult.message, repoResult.guidance);
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            try {
                const updated = await state.client(token.token.value).requestJson('PATCH', `/repos/${repoResult.repo}/pulls/${ref.number}`, {
                    signal: exec.signal,
                    body: {
                        ...args.title !== undefined ? { title: args.title } : {},
                        ...args.body !== undefined ? { body: args.body } : {},
                        ...args.state !== undefined ? { state: args.state } : {},
                        ...args.base !== undefined ? { base: args.base } : {},
                    },
                });
                const data = updated.data;
                return {
                    status: 'updated',
                    url: data.html_url,
                    number: data.number,
                    title: data.title,
                    state: data.state,
                    base: data.base?.ref ?? '',
                    rateLimit: rateLimitValue(updated.rateLimit),
                };
            }
            catch (error) {
                return githubErrorValue(error);
            }
        },
    });
}
/** `gh_repo`: read one repository's metadata (read; concurrency-safe). */
export function ghRepoTool(state) {
    return defineTool({
        name: 'gh_repo',
        description: 'Read a GitHub repository\'s metadata: description, default branch, visibility, stars, forks, '
            + 'open issues, language, license, topics, and last update. Read-only and concurrency-safe.',
        parameters: {
            ownerRepo: { type: 'string', description: 'Repository as owner/repo. Defaults to configured or git origin.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            repo: { type: 'string', required: true },
                            description: { type: 'string', required: true },
                            defaultBranch: { type: 'string', required: true },
                            visibility: { type: 'string', required: true },
                            stars: { type: 'integer', required: true },
                            forks: { type: 'integer', required: true },
                            openIssues: { type: 'integer', required: true },
                            language: { type: 'string', required: true },
                            license: { type: 'string', required: true },
                            topics: { type: 'array', required: true, items: { type: 'string' } },
                            url: { type: 'string', required: true },
                            updatedAt: { type: 'string', required: true },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if ('status' in value) {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                return [{
                        type: 'text',
                        text: `${value.repo}: ${value.description}\n`
                            + `default branch ${value.defaultBranch} · ${value.language} · ${value.license}\n`
                            + `stars ${value.stars} · forks ${value.forks} · open issues ${value.openIssues} · ${value.visibility}\n${value.url}`,
                    }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => true,
        presentCall: ghRepoCall,
        presentResult: ghRepoResult,
        async execute(args, exec) {
            const repoResult = await state.resolveRepo(args.ownerRepo, exec.signal);
            if (!repoResult.ok)
                return errorValue(repoResult.code, repoResult.message, repoResult.guidance);
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            try {
                const response = await state.client(token.token.value).requestJson('GET', `/repos/${repoResult.repo}`, { signal: exec.signal });
                const data = response.data;
                const value = {
                    repo: repoResult.repo,
                    description: data.description ?? '',
                    defaultBranch: data.default_branch ?? '',
                    visibility: data.visibility ?? 'unknown',
                    stars: data.stargazers_count ?? 0,
                    forks: data.forks_count ?? 0,
                    openIssues: data.open_issues_count ?? 0,
                    language: data.language ?? '',
                    license: data.license?.spdx_id ?? '',
                    topics: data.topics ?? [],
                    url: data.html_url ?? '',
                    updatedAt: data.updated_at ?? '',
                    rateLimit: rateLimitValue(response.rateLimit),
                };
                return value;
            }
            catch (error) {
                return githubErrorValue(error);
            }
        },
    });
}
/** `gh_file`: read one file from a repository (read; concurrency-safe). */
export function ghFileTool(state) {
    return defineTool({
        name: 'gh_file',
        description: 'Read one file from a GitHub repository at a branch, tag, or commit (defaults to the default '
            + 'branch). File contents are base64-decoded and capped; directories and oversized blobs are reported '
            + 'as structured errors. Read-only and concurrency-safe.',
        parameters: {
            ownerRepo: { type: 'string', description: 'Repository as owner/repo. Defaults to configured or git origin.' },
            path: { type: 'string', required: true, description: 'Repository file path, e.g. "README.md" or "src/index.ts".' },
            ref: { type: 'string', description: 'Branch, tag, or commit SHA. Defaults to the default branch.' },
            maxChars: { type: 'number', description: 'Cap for the file contents. Defaults to the plugin config.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            repo: { type: 'string', required: true },
                            path: { type: 'string', required: true },
                            ref: { type: 'string', required: true },
                            size: { type: 'integer', required: true },
                            truncated: { type: 'boolean', required: true },
                            content: { type: 'string', required: true },
                            sha: { type: 'string', required: true },
                            url: { type: 'string', required: true },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if ('status' in value) {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                return [{
                        type: 'text',
                        text: `${value.repo}/${value.path} @ ${value.ref} (${value.size} bytes${value.truncated ? ', truncated' : ''}):\n${value.content}`,
                    }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => true,
        presentCall: ghFileCall,
        presentResult: ghFileResult,
        async execute(args, exec) {
            const path = args.path.trim();
            if (path.length === 0 || path.startsWith('/'))
                return errorValue('invalid-args', 'path must be a non-empty repository-relative file path');
            const repoResult = await state.resolveRepo(args.ownerRepo, exec.signal);
            if (!repoResult.ok)
                return errorValue(repoResult.code, repoResult.message, repoResult.guidance);
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            const maxChars = args.maxChars !== undefined && args.maxChars > 0 ? Math.floor(args.maxChars) : state.config.maxFileChars;
            const query = args.ref !== undefined ? `?ref=${encodeURIComponent(args.ref)}` : '';
            const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
            try {
                const response = await state.client(token.token.value).requestJson('GET', `/repos/${repoResult.repo}/contents/${encodedPath}${query}`, { signal: exec.signal });
                const data = response.data;
                if (Array.isArray(data)) {
                    return errorValue('is-directory', `"${path}" is a directory; pass a file path`, 'List the directory with gh_file on its entries or use a narrower path.');
                }
                const raw = data.content ?? '';
                const text = data.encoding === 'base64' && raw.length > 0 ? Buffer.from(raw, 'base64').toString('utf8') : raw;
                const capped = capText(text, maxChars);
                const value = {
                    repo: repoResult.repo,
                    path: data.path ?? path,
                    ref: args.ref ?? 'default',
                    size: data.size ?? Buffer.byteLength(text),
                    truncated: capped.truncated,
                    content: capped.text,
                    sha: data.sha ?? '',
                    url: data.html_url ?? '',
                    rateLimit: rateLimitValue(response.rateLimit),
                };
                return value;
            }
            catch (error) {
                return githubErrorValue(error);
            }
        },
    });
}
// ── GraphQL tools (search + PR checks) ──────────────────────────────────────
/** Split an `owner/repo` pair into its two parts (assumes the repo already validated). */
function ownerNameOf(repo) {
    const index = repo.indexOf('/');
    return { owner: repo.slice(0, index), name: repo.slice(index + 1) };
}
/** `gh_repo_search`: GraphQL repository search (read; separate search quota). */
export function ghRepoSearchTool(state) {
    return defineTool({
        name: 'gh_repo_search',
        description: 'Search GitHub repositories by name, description, or README (GitHub search syntax, e.g. '
            + '"dsh-plugin in:name,description"). Backed by the GraphQL search API; read-only and concurrency-safe. '
            + 'Uses the separate search quota.',
        parameters: {
            q: { type: 'string', required: true, description: 'Repository search query in GitHub search syntax.' },
            perPage: { type: 'integer', description: 'Max results. Defaults to 20, capped at 50.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            query: { type: 'string', required: true },
                            total: { type: 'integer', required: true },
                            items: {
                                type: 'array',
                                required: true,
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        repo: { type: 'string', required: true },
                                        description: { type: 'string', required: true },
                                        stars: { type: 'integer', required: true },
                                        language: { type: 'string', required: true },
                                        url: { type: 'string', required: true },
                                    },
                                },
                            },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if ('status' in value) {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                if (value.items.length === 0)
                    return [{ type: 'text', text: `no repositories for "${value.query}"` }];
                return [{
                        type: 'text',
                        text: value.items.map(item => `${item.repo} ★${item.stars} [${item.language}] — ${item.description || '(no description)'}\n${item.url}`).join('\n\n'),
                    }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => true,
        async execute(args, exec) {
            const q = args.q.trim();
            if (q.length === 0)
                return errorValue('invalid-args', 'q must not be empty');
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            const perPage = Math.min(Math.max(args.perPage ?? 20, 1), 50);
            const document = 'query($q: String!, $n: Int!) { search(query: $q, type: REPOSITORY, first: $n) { repositoryCount edges { node { ... on Repository { nameWithOwner description stargazerCount url primaryLanguage { name } } } } } }';
            try {
                const response = await state.graphqlClient(token.token.value).query(document, { q, n: perPage }, exec.signal);
                const search = response.data.search;
                const value = {
                    query: q,
                    total: search.repositoryCount,
                    items: search.edges.map(edge => ({
                        repo: edge.node.nameWithOwner,
                        description: edge.node.description ?? '',
                        stars: edge.node.stargazerCount,
                        language: edge.node.primaryLanguage?.name ?? '',
                        url: edge.node.url,
                    })),
                    rateLimit: rateLimitValue(response.rateLimit),
                };
                return value;
            }
            catch (error) {
                return githubErrorValue(error);
            }
        },
    });
}
/** `gh_checks`: GraphQL PR status-check rollup (read; batched GraphQL contexts). */
export function ghChecksTool(state) {
    return defineTool({
        name: 'gh_checks',
        description: 'Read a pull request\'s CI status checks (check runs and commit statuses) via the GraphQL API. '
            + 'Returns the rollup state and one entry per check with its status/conclusion and URL. Read-only and '
            + 'concurrency-safe. `pr` accepts a number, "#number", "owner/repo#number", or a pull-request URL.',
        parameters: {
            pr: { type: 'string', required: true, description: 'PR number, #number, owner/repo#number, or pull URL.' },
        },
        output: {
            schema: {
                oneOf: [{
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            repo: { type: 'string', required: true },
                            number: { type: 'integer', required: true },
                            title: { type: 'string', required: true },
                            state: { type: 'string', required: true },
                            rollup: { type: 'string', required: true },
                            items: {
                                type: 'array',
                                required: true,
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        name: { type: 'string', required: true },
                                        state: { type: 'string', required: true },
                                        conclusion: { type: 'string' },
                                        url: { type: 'string' },
                                    },
                                },
                            },
                            rateLimit: RATE_LIMIT_SCHEMA,
                        },
                    }, ERROR_SCHEMA],
            },
            render: (_args, value) => {
                if ('status' in value) {
                    return [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }];
                }
                const lines = [`${value.repo}#${value.number} "${value.title}" — rollup ${value.rollup} (${value.state})`];
                if (value.items.length === 0)
                    lines.push('(no checks reported)');
                for (const item of value.items) {
                    lines.push(`- ${item.name}: ${item.state}${item.conclusion !== null ? ` / ${item.conclusion}` : ''}${item.url !== null ? ` — ${item.url}` : ''}`);
                }
                return [{ type: 'text', text: lines.join('\n') }];
            },
            presentationMeta: identityMeta,
        },
        isConcurrencySafe: () => true,
        async execute(args, exec) {
            const ref = state.parsePrRef(args.pr);
            if (ref === null)
                return errorValue('invalid-pr', `"${args.pr}" is not a PR reference`, 'Use a number, "#number", "owner/repo#number", or a pull URL.');
            const repoResult = ref.repo !== undefined ? { ok: true, repo: ref.repo } : await state.resolveRepo(undefined, exec.signal);
            if (!repoResult.ok)
                return errorValue(repoResult.code, repoResult.message, repoResult.guidance);
            const token = await state.resolveToken(exec.signal);
            if (!token.ok)
                return errorValue(token.error.code, token.error.message, token.error.guidance);
            const { owner, name } = ownerNameOf(repoResult.repo);
            const document = [
                'query($owner: String!, $name: String!, $number: Int!) {',
                '  repository(owner: $owner, name: $name) {',
                '    pullRequest(number: $number) {',
                '      number title state',
                '      commits(last: 1) {',
                '        nodes {',
                '          commit {',
                '            statusCheckRollup {',
                '              state',
                '              contexts(first: 100) {',
                '                nodes {',
                '                  __typename',
                '                  ... on CheckRun { name status conclusion detailsUrl }',
                '                  ... on StatusContext { context state description targetUrl }',
                '                }',
                '              }',
                '            }',
                '          }',
                '        }',
                '      }',
                '    }',
                '  }',
                '}',
            ].join('\n');
            try {
                const response = await state.graphqlClient(token.token.value).query(document, { owner, name, number: ref.number }, exec.signal);
                const pr = response.data.repository.pullRequest;
                if (pr === null)
                    return errorValue('not-found', `pull request #${ref.number} not found in ${repoResult.repo}`);
                const rollup = pr.commits.nodes[0]?.commit.statusCheckRollup;
                const value = {
                    repo: repoResult.repo,
                    number: pr.number,
                    title: pr.title,
                    state: pr.state,
                    rollup: rollup?.state ?? 'UNKNOWN',
                    items: (rollup?.contexts.nodes ?? []).map(node => {
                        const url = node.detailsUrl ?? node.targetUrl;
                        return {
                            name: node.name ?? node.context ?? 'unknown',
                            state: node.status ?? node.state ?? 'unknown',
                            ...(node.conclusion == null ? {} : { conclusion: node.conclusion }),
                            ...(url == null ? {} : { url }),
                        };
                    }),
                    rateLimit: rateLimitValue(response.rateLimit),
                };
                return value;
            }
            catch (error) {
                return githubErrorValue(error);
            }
        },
    });
}
//# sourceMappingURL=tools.js.map