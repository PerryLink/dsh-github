/**
 * Translate one glob into an anchored RegExp supporting `*`, `**`, and `?`.
 * A pattern without a `/` is a basename glob and matches at any depth
 * (`.env` matches `config/.env`, `*.pem` matches `certs/server.pem`);
 * patterns containing `/` match against the whole repository path.
 */
export function globToRegExp(pattern) {
    let source = '';
    for (let index = 0; index < pattern.length; index += 1) {
        const char = pattern[index] ?? '';
        if (char === '*') {
            if (pattern[index + 1] === '*') {
                // `**/` matches any directory depth (including none).
                if (pattern[index + 2] === '/') {
                    source += '(?:.*/)?';
                    index += 2;
                    continue;
                }
                source += '.*';
                index += 1;
                continue;
            }
            source += '[^/]*';
            continue;
        }
        if (char === '?') {
            source += '[^/]';
            continue;
        }
        if ('\\^$.*+?()[]{}|'.includes(char))
            source += `\\${char}`;
        else
            source += char;
    }
    const prefix = pattern.includes('/') ? '' : '(?:.*/)?';
    return new RegExp(`^${prefix}${source}$`);
}
/** Whether a repository path matches any of the configured globs. */
export function matchesAnyGlob(path, patterns) {
    const regexes = patterns.map(pattern => globToRegExp(pattern));
    return regexes.some(regex => regex.test(path));
}
/** PR-level findings for one pull request; deterministic and ordered. */
export function analyzePr(input) {
    const findings = [];
    const { files, options } = input;
    // Sensitive files: credentials, keys, secrets, and CI workflow edits need
    // human eyes regardless of what the diff text itself looks like.
    if (options.sensitivePathPatterns.length > 0) {
        for (const file of files) {
            if (matchesAnyGlob(file.path, options.sensitivePathPatterns)) {
                findings.push({
                    file: file.path,
                    line: null,
                    severity: options.sensitiveSeverity,
                    rule: 'sensitive-file',
                    message: 'sensitive path changed (credentials, keys, secrets, or CI workflows); review carefully and never embed secrets',
                });
            }
        }
    }
    // Change scope: total file count and line totals beyond the caps.
    if (files.length > options.maxChangedFiles) {
        findings.push({
            file: '',
            line: null,
            severity: 'info',
            rule: 'large-change',
            message: `PR touches ${files.length} files (cap ${options.maxChangedFiles}); consider splitting it into smaller changes`,
        });
    }
    if (input.additions > options.maxAddedLines) {
        findings.push({
            file: '',
            line: null,
            severity: 'info',
            rule: 'large-change',
            message: `PR adds ${input.additions} lines (cap ${options.maxAddedLines}); consider splitting it into smaller changes`,
        });
    }
    if (input.deletions > options.maxRemovedLines) {
        findings.push({
            file: '',
            line: null,
            severity: 'info',
            rule: 'large-change',
            message: `PR removes ${input.deletions} lines (cap ${options.maxRemovedLines}); double-check the removed behavior`,
        });
    }
    // Test existence: code changed without any test change.
    if (options.codeExtensions.length > 0 && options.testPathPatterns.length > 0) {
        const isCode = (path) => options.codeExtensions.some(ext => path.toLowerCase().endsWith(ext.toLowerCase()));
        const isTest = (path) => matchesAnyGlob(path, options.testPathPatterns);
        const codeFiles = files.filter(file => isCode(file.path));
        const testFiles = files.filter(file => isTest(file.path));
        if (codeFiles.length > 0 && testFiles.length === 0) {
            findings.push({
                file: '',
                line: null,
                severity: 'warning',
                rule: 'missing-tests',
                message: `${codeFiles.length} code file(s) changed with no test changes; consider adding coverage for the new behavior`,
            });
        }
    }
    return findings;
}
//# sourceMappingURL=review-rules.js.map