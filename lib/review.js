/**
 * Deterministic multi-file PR analyzer: parses a unified diff and produces a
 * structured finding list plus a ready-to-post Markdown comment body.
 *
 * The analyzer is intentionally model-free — it runs inside the background
 * review job without spending tokens, is deterministic, and its output is the
 * only content the `/review post` approval offers for posting. A model-based
 * review pass (subagent seam) is a documented v2 extension point.
 * @module dsh-github/review
 */
const MAX_FINDINGS = 50;
const LINE_RULES = [
    { rule: 'hardcoded-secret', severity: 'error', message: 'possible hardcoded secret (token/private key); inject via credentials instead', pattern: /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/ },
    { rule: 'debug-artifact', severity: 'warning', message: 'debug statement; remove before merging', pattern: /\b(console\.(log|debug|warn)|debugger)\b/ },
    { rule: 'eval-usage', severity: 'warning', message: 'dynamic evaluation (eval/new Function); avoid unless necessary', pattern: /\beval\s*\(|new\s+Function\s*\(/ },
    { rule: 'todo-marker', severity: 'info', message: 'leftover marker (TODO/FIXME/XXX); confirm it is tracked', pattern: /\b(TODO|FIXME|XXX)\b/ },
];
const MAX_LINE_LENGTH = 300;
/** Split a unified diff into per-file added lines with new-file line numbers. */
export function parseAddedLines(diff, maxChars) {
    const limited = diff.length > maxChars ? diff.slice(0, maxChars) : diff;
    const lines = limited.split(/\r?\n/);
    const added = [];
    let hunk = null;
    for (const line of lines) {
        if (line.startsWith('+++ ')) {
            const file = line.slice(4).trim().replace(/^b\//, '');
            if (file !== '/dev/null')
                hunk = { file, newStart: 0, newLine: 0 };
            continue;
        }
        if (hunk === null)
            continue;
        const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
        if (match) {
            const start = Number(match[1]);
            hunk.newStart = start;
            hunk.newLine = start;
            continue;
        }
        if (line.startsWith('+') && !line.startsWith('+++')) {
            added.push({ file: hunk.file, line: hunk.newLine, text: line.slice(1) });
            hunk.newLine += 1;
        }
        else if (line.startsWith('-') && !line.startsWith('---')) {
            // Removed line: new-file numbering does not advance.
        }
        else if (line.startsWith(' ')) {
            hunk.newLine += 1;
        }
    }
    return added;
}
/** Parse per-file added/removed counts out of a unified diff. */
export function parseDiffStats(diff, maxChars) {
    const limited = diff.length > maxChars ? diff.slice(0, maxChars) : diff;
    const lines = limited.split(/\r?\n/);
    const stats = new Map();
    let current = null;
    for (const line of lines) {
        if (line.startsWith('+++ ')) {
            const file = line.slice(4).trim().replace(/^b\//, '');
            if (file === '/dev/null') {
                current = null;
                continue;
            }
            current = stats.get(file) ?? { path: file, added: 0, removed: 0 };
            stats.set(file, current);
        }
        else if (current !== null && line.startsWith('+') && !line.startsWith('+++')) {
            current.added += 1;
        }
        else if (current !== null && line.startsWith('-') && !line.startsWith('---')) {
            current.removed += 1;
        }
    }
    return [...stats.values()];
}
/**
 * Analyze a unified diff into findings and a postable comment body.
 * @param diff - unified diff text (already capped by the caller or capped here).
 * @param maxChars - byte-ish cap applied before parsing.
 * @returns findings (capped), one-line summary, and Markdown post body.
 */
export function analyzeDiff(diff, maxChars) {
    const added = parseAddedLines(diff, maxChars);
    const findings = [];
    const perFileAdded = new Map();
    for (const item of added) {
        perFileAdded.set(item.file, (perFileAdded.get(item.file) ?? 0) + 1);
        if (findings.length >= MAX_FINDINGS)
            break;
        for (const rule of LINE_RULES) {
            if (rule.pattern.test(item.text)) {
                findings.push({ file: item.file, line: item.line, severity: rule.severity, rule: rule.rule, message: rule.message });
                break;
            }
        }
        if (findings.length >= MAX_FINDINGS)
            break;
        if (item.text.length > MAX_LINE_LENGTH) {
            findings.push({ file: item.file, line: item.line, severity: 'info', rule: 'long-line', message: `line exceeds ${MAX_LINE_LENGTH} characters; consider splitting it` });
        }
    }
    for (const [file, count] of perFileAdded) {
        if (findings.length >= MAX_FINDINGS)
            break;
        if (count > 400)
            findings.push({ file, line: null, severity: 'info', rule: 'large-change', message: `this PR adds ${count} lines to this file; consider splitting the commit` });
    }
    const truncated = diff.length > maxChars;
    const summary = findings.length === 0
        ? `review complete: ${added.length} added line(s), no obvious issues found${truncated ? ' (diff truncated)' : ''}`
        : `review complete: ${findings.length} finding(s) (${countSeverity(findings, 'error')} error / ${countSeverity(findings, 'warning')} warning / ${countSeverity(findings, 'info')} info)${truncated ? ' (diff truncated)' : ''}`;
    return { findings, summary, postBody: formatPostBody(findings, truncated) };
}
function countSeverity(findings, severity) {
    return findings.filter(finding => finding.severity === severity).length;
}
/** Markdown comment body grouped by file, ready for a PR issue comment. */
export function formatPostBody(findings, truncated) {
    if (findings.length === 0) {
        return `## dsh-github review\n\nNo obvious issues found.${truncated ? '\n\n> Note: the diff exceeded the cap and was truncated.' : ''}`;
    }
    const byFile = new Map();
    for (const finding of findings) {
        const list = byFile.get(finding.file) ?? [];
        list.push(finding);
        byFile.set(finding.file, list);
    }
    const sections = ['## dsh-github review\n'];
    for (const [file, fileFindings] of byFile) {
        sections.push(`### ${file}\n`);
        for (const finding of fileFindings) {
            const line = finding.line === null ? '' : `:${finding.line}`;
            sections.push(`- **${finding.severity}** \`${finding.rule}\`${line}: ${finding.message}`);
        }
        sections.push('');
    }
    if (truncated)
        sections.push('> Note: the diff exceeded the cap and was truncated; this report only covers the examined range.');
    sections.push('');
    sections.push('*Generated by [dsh-github](https://github.com/PerryLink/dsh-github); published after human approval.*');
    return sections.join('\n');
}
//# sourceMappingURL=review.js.map