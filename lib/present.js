/** Pending card for pr_create. */
export function prCreateCall(args) {
    return {
        card: 'generic',
        title: `Create pull request: ${args.title}`,
        rawInput: {
            title: args.title,
            ...args.base !== undefined ? { base: args.base } : {},
            ...args.head !== undefined ? { head: args.head } : {},
            ...args.draft !== undefined ? { draft: args.draft } : {},
            ...args.ownerRepo !== undefined ? { ownerRepo: args.ownerRepo } : {},
        },
    };
}
/** Completed card for pr_create: the PR link, or a readable failure. */
export function prCreateResult(_args, result) {
    const value = result.meta;
    if (value === undefined)
        return undefined;
    if (value.status === 'error') {
        return { card: 'generic', title: 'Pull request not created', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] };
    }
    return {
        card: 'generic',
        title: `Created pull request #${value.number}`,
        content: [{ type: 'text', text: `${value.url}\n${value.base} ← ${value.head}${value.draft ? ' (draft)' : ''}` }],
    };
}
/** Pending card for review_post. */
export function reviewPostCall(args) {
    return { card: 'generic', title: `Post review comments (job ${args.jobId})`, rawInput: { jobId: args.jobId, ...args.mode !== undefined ? { mode: args.mode } : {} } };
}
/** Completed card for review_post. */
export function reviewPostResult(_args, result) {
    const value = result.meta;
    if (value === undefined)
        return undefined;
    if (value.status === 'error') {
        return { card: 'generic', title: 'Review comments not posted', content: [{ type: 'text', text: value.message }] };
    }
    const kind = value.mode === 'inline' ? 'Inline review' : 'Review comments';
    return { card: 'generic', title: `${kind} posted`, content: [{ type: 'text', text: `${value.url}\n${value.findings} finding(s) reported` }] };
}
/** Pending card for issue_open. */
export function issueOpenCall(args) {
    return { card: 'generic', title: `Create issue: ${args.title}`, rawInput: { title: args.title } };
}
/** Completed card for issue_open. */
export function issueOpenResult(_args, result) {
    const value = result.meta;
    if (value === undefined)
        return undefined;
    if (value.status === 'error') {
        return { card: 'generic', title: 'Issue not created', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] };
    }
    return { card: 'generic', title: `Created issue #${value.number}`, content: [{ type: 'text', text: value.url }] };
}
/** Pending card for issue_comment. */
export function issueCommentCall(args) {
    return { card: 'generic', title: `Comment on #${args.issueNumber}`, rawInput: { issueNumber: args.issueNumber, ...args.ownerRepo !== undefined ? { ownerRepo: args.ownerRepo } : {} } };
}
/** Completed card for issue_comment. */
export function issueCommentResult(_args, result) {
    const value = result.meta;
    if (value === undefined)
        return undefined;
    if (value.status === 'error') {
        return { card: 'generic', title: 'Comment not posted', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] };
    }
    return { card: 'generic', title: `Commented on #${value.issueNumber}`, content: [{ type: 'text', text: value.url }] };
}
/** Pending card for issue_close. */
export function issueCloseCall(args) {
    return { card: 'generic', title: `Close issue #${args.issueNumber}`, rawInput: { issueNumber: args.issueNumber, ...args.stateReason !== undefined ? { stateReason: args.stateReason } : {} } };
}
/** Completed card for issue_close. */
export function issueCloseResult(_args, result) {
    const value = result.meta;
    if (value === undefined)
        return undefined;
    if (value.status === 'error') {
        return { card: 'generic', title: 'Issue not closed', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] };
    }
    return { card: 'generic', title: `Closed issue #${value.number}`, content: [{ type: 'text', text: value.url }] };
}
/** Pending card for gh_review. */
export function ghReviewCall(args) {
    return { card: 'generic', title: `Review PR ${args.pr}`, rawInput: { pr: args.pr, fields: args.fields ?? 'all' } };
}
/** Completed card for gh_review: headline facts and CI state. */
export function ghReviewResult(_args, result) {
    const value = result.meta;
    if (value === undefined)
        return undefined;
    if ('status' in value) {
        return { card: 'generic', title: 'PR review failed', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] };
    }
    return {
        card: 'generic',
        title: `PR #${value.number} — ${value.title}`,
        content: [{
                type: 'text',
                text: `${value.repo} · ${value.state} · ${value.base} ← ${value.head}\n`
                    + `+${value.additions} −${value.deletions} · ${value.comments.items?.length ?? 0} comment(s) · ${value.findings?.length ?? 0} finding(s)\n`
                    + `CI: ${value.ci.summary}`,
            }],
    };
}
/** Pending card for gh_issue. */
export function ghIssueCall(args) {
    return { card: 'generic', title: `GitHub issues: ${args.action}`, rawInput: args };
}
/** Completed card for gh_issue. */
export function ghIssueResult(_args, result) {
    const value = result.meta;
    if (value === undefined)
        return undefined;
    if ('status' in value) {
        return { card: 'generic', title: 'Issue read failed', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] };
    }
    return {
        card: 'generic',
        title: `Issues (${value.action}) — ${value.repo}`,
        content: [{ type: 'text', text: (value.items ?? []).map(item => `#${item.number} ${item.title} [${item.kind}/${item.state}]`).join('\n') || '(no issues)' }],
    };
}
/** Pending card for gh_search. */
export function ghSearchCall(args) {
    return { card: 'generic', title: `Search GitHub: ${args.q}`, rawInput: { q: args.q } };
}
/** Completed card for gh_search. */
export function ghSearchResult(_args, result) {
    const value = result.meta;
    if (value === undefined)
        return undefined;
    if ('status' in value) {
        return { card: 'generic', title: 'Search failed', content: [{ type: 'text', text: `${value.message}${value.guidance !== undefined ? `\n${value.guidance}` : ''}` }] };
    }
    return {
        card: 'generic',
        title: `Search results — ${value.total} total`,
        content: [{ type: 'text', text: value.items.map(item => `#${item.number} ${item.title} [${item.kind}/${item.state}] ${item.repo}`).join('\n') || '(no results)' }],
    };
}
/** Identity projection: persist the whole canonical value for card replay. */
export function identityMeta(_args, value) {
    return value;
}
//# sourceMappingURL=present.js.map