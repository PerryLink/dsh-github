const ACTION_BY_TOOL = {
    pr_create: 'pr.create',
    review_post: 'review.post',
    issue_open: 'issue.create',
};
/** Tools the gate intercepts; everything else delegates via next(). */
const WRITE_TOOLS = new Set(Object.keys(ACTION_BY_TOOL));
/** Read the frozen tool arguments as a plain object, tolerant of bad input. */
function argumentsAsRecord(exec) {
    return typeof exec.arguments === 'object' && exec.arguments !== null ? exec.arguments : {};
}
/** Human-readable reason for the approval prompt of one write call. */
function askReason(toolName, args, state) {
    if (toolName === 'pr_create') {
        const title = typeof args.title === 'string' ? args.title : '(untitled)';
        return `create GitHub pull request "${title}"`;
    }
    if (toolName === 'review_post') {
        if (typeof args.jobId !== 'string')
            return 'post GitHub review comments';
        const record = state.records.get(args.jobId);
        if (record === undefined || record.report === null)
            return `post GitHub review comments for job ${args.jobId}`;
        return `post GitHub review comments for PR #${record.pr} (${record.report.findings.length} finding(s))`;
    }
    if (toolName === 'issue_open') {
        const title = typeof args.title === 'string' ? args.title : '(untitled)';
        return `create GitHub issue "${title}"`;
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