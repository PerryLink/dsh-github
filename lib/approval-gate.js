const ACTION_BY_TOOL = {
    pr_create: 'pr.create',
    review_post: 'review.post',
    issue_open: 'issue.create',
    issue_comment: 'issue.comment',
    issue_close: 'issue.close',
};
/** Tools the gate intercepts; everything else delegates via next(). */
const WRITE_TOOLS = new Set(Object.keys(ACTION_BY_TOOL));
/** Read the frozen tool arguments as a plain object, tolerant of bad input. */
function argumentsAsRecord(exec) {
    return typeof exec.arguments === 'object' && exec.arguments !== null ? exec.arguments : {};
}
/** `"title" (body N chars)`-style preview of a titled write. */
function titledPreview(args) {
    const title = typeof args.title === 'string' ? args.title : '(untitled)';
    const body = typeof args.body === 'string' ? args.body.trim() : '';
    return body.length === 0 ? `"${title}"` : `"${title}" (body ${body.length} chars)`;
}
/** First line of a string, elided to `max` characters. */
function firstLine(value, max) {
    const line = value.split('\n')[0] ?? '';
    return line.length > max ? `${line.slice(0, max)}…` : line;
}
/** Human-readable reason for the approval prompt of one write call. */
function askReason(toolName, args, state) {
    if (toolName === 'pr_create') {
        return `create GitHub pull request ${titledPreview(args)}`;
    }
    if (toolName === 'review_post') {
        if (typeof args.jobId !== 'string')
            return 'post GitHub review comments';
        const record = state.records.get(args.jobId);
        const target = record === undefined || record.report === null
            ? `job ${args.jobId}`
            : `PR #${record.pr} (${record.report.findings.length} finding(s))`;
        const mode = args.mode === 'inline' ? 'inline' : 'summary';
        const override = typeof args.body === 'string' && args.body.trim().length > 0
            ? `; body override: ${firstLine(args.body.trim(), 80)}`
            : '';
        return `post GitHub review comments for ${target} (${mode})${override}`;
    }
    if (toolName === 'issue_open') {
        return `create GitHub issue ${titledPreview(args)}`;
    }
    if (toolName === 'issue_comment') {
        const number = typeof args.issueNumber === 'number' ? ` #${args.issueNumber}` : '';
        const body = typeof args.body === 'string' ? args.body.trim() : '';
        return `comment on GitHub issue${number}${body.length === 0 ? '' : ` (body ${body.length} chars)`}`;
    }
    if (toolName === 'issue_close') {
        const number = typeof args.issueNumber === 'number' ? ` #${args.issueNumber}` : '';
        return `close GitHub issue${number}`;
    }
    return 'perform a GitHub write action';
}
/**
 * Register the approval gate. Registration is an effect: disposing the plugin
 * fiber removes the listener.
 * @param ctx - plugin context; the listener lives on the shared tools pipeline.
 * @param state - plugin state used to enrich approval reasons.
 * @returns the effect disposer.
 */
export function registerApprovalGate(ctx, state) {
    return ctx.on('tools/pre-execute', async (exec, next) => {
        if (!WRITE_TOOLS.has(exec.name))
            return next();
        const action = ACTION_BY_TOOL[exec.name];
        if (action === undefined || !state.config.allowedActions.includes(action)) {
            return { kind: 'deny', reason: `dsh-github: action "${action ?? exec.name}" is not in allowedActions` };
        }
        return { kind: 'ask', reason: `dsh-github: ${askReason(exec.name, argumentsAsRecord(exec), state)}` };
    });
}
//# sourceMappingURL=approval-gate.js.map