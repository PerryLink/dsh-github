/**
 * Schemastery configuration for dsh-github.
 *
 * Every tunable is changeable from cordis.yml; the schema validates at load
 * time and fails loud on invalid values. Secrets are NOT config fields: the
 * token always travels through the credentials seam (a reference name here,
 * never a value).
 * @module dsh-github/config
 */
import z from '@deepseek-ai/schemastery';
const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
/** Default sensitive-path globs for the sensitive-file rule. */
export const DEFAULT_SENSITIVE_PATTERNS = [
    '.env', '.env.*', '*.pem', '*.key', '*.p12', '*.pfx',
    'id_rsa*', 'id_ed25519*', 'id_dsa*',
    '**/credentials*.json', '**/secrets/**', '**/.npmrc', '**/.pypirc',
    '.github/workflows/*.yml', '.github/workflows/*.yaml',
];
/** Default code extensions for the test-existence rule (with leading dot). */
export const DEFAULT_CODE_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs',
    '.java', '.kt', '.c', '.h', '.cpp', '.hpp', '.cs', '.rb', '.php',
    '.swift', '.scala', '.sh', '.ps1',
];
/** Default test-path globs for the test-existence rule. */
export const DEFAULT_TEST_PATTERNS = [
    '**/test/**', '**/tests/**', '**/__tests__/**', '**/spec/**', '**/e2e/**',
    '**/*.test.*', '**/*.spec.*', '**/test_*', '**/*_test.*',
];
const CI_ACTION_VALUES = ['pr.create', 'review.post', 'issue.create', 'issue.comment', 'issue.close', 'pr.merge', 'pr.update', 'ci.run'];
export const CiConfig = z.object({
    enabled: z.boolean().default(false)
        .description('Master switch for the CI surface (ci_run tool, review bot, /ci commands, status-check gate).'),
    engine: z.union(['static', 'model']).default('static')
        .description('Review engine: static (deterministic analyzer) or model (headless agent authors the review body).'),
    autoApprove: z.array(z.union(CI_ACTION_VALUES)).default([])
        .description('Write actions auto-allowed while running as the CI driver (DSH_GITHUB_CI_DRIVER=1); interactive sessions always ask.'),
    checkName: z.string().default('dsh-github-review')
        .description('Status-check name published by the CI gate.'),
    blocking: z.boolean().default(true)
        .description('needs-changes verdict fails the check; false publishes a neutral (non-blocking) conclusion.'),
    failOn: z.union(['error', 'warning']).default('error')
        .description('Lowest finding severity that flips the verdict to needs-changes.'),
    pollIntervalMs: z.number().step(1).min(0).default(60_000)
        .description('Review-bot poll interval; 0 disables polling (manual /ci scan still works).'),
    labelFilters: z.array(z.string()).default([])
        .description('Label filters for the bot and pipeline; a PR must carry at least one listed label. Empty matches all.'),
    pathFilters: z.array(z.string()).default([])
        .description('Path globs for the bot and pipeline; when set, a PR must touch at least one matching path. Empty matches all.'),
    sensitivePathPatterns: z.array(z.string()).default(DEFAULT_SENSITIVE_PATTERNS)
        .description('Sensitive-path globs flagged by the sensitive-file rule.'),
    sensitiveSeverity: z.union(['error', 'warning']).default('warning')
        .description('Severity of the sensitive-file rule.'),
    codeExtensions: z.array(z.string()).default(DEFAULT_CODE_EXTENSIONS)
        .description('Extensions treated as code by the test-existence rule (leading dot).'),
    testPathPatterns: z.array(z.string()).default(DEFAULT_TEST_PATTERNS)
        .description('Path globs treated as tests by the test-existence rule.'),
    maxChangedFiles: z.number().step(1).min(1).default(30)
        .description('File-count cap before a large-change finding.'),
    maxAddedLines: z.number().step(1).min(1).default(1000)
        .description('Added-line cap before a large-change finding.'),
    maxRemovedLines: z.number().step(1).min(1).default(1000)
        .description('Removed-line cap before a large-change finding.'),
    maxConcurrent: z.number().step(1).min(1).default(2)
        .description('Cap of concurrently reviewed PRs inside one bot scan.'),
    postComments: z.boolean().default(true)
        .description('Whether the CI pipeline posts review comments (inline findings plus the PR-level body).'),
    reportDir: z.string().default('')
        .description('Report-file directory; defaults to DSH_GITHUB_CI_OUTPUT_DIR, then the workspace directory.'),
});
export const Config = z.object({
    tokenSource: z.union(['auto', 'credentials', 'env', 'gh'])
        .default('auto')
        .description('Token lookup source: auto tries credentials → env → gh in order.'),
    tokenRef: z.string()
        .pattern(/^[A-Za-z_][A-Za-z0-9_]*$/)
        .default('GITHUB_TOKEN')
        .description('Credential reference / environment variable name holding the token.'),
    defaultOwnerRepo: z.string()
        .pattern(OWNER_REPO_PATTERN)
        .description('Fallback owner/repo when neither the call nor git names one.'),
    autoCommit: z.boolean()
        .default(false)
        .description('Whether /pr create may instruct the model to commit and push first.'),
    maxDiffChars: z.number().step(1).min(1)
        .default(8000)
        .description('Character cap for PR diffs read into a review.'),
    renderExcerptChars: z.number().step(1).min(1)
        .default(2000)
        .description('Character cap for the diff excerpt rendered into tool output.'),
    maxComments: z.number().step(1).min(1)
        .default(20)
        .description('Cap for PR comments listed by gh_review.'),
    reviewJobTimeoutMs: z.number().step(1).min(1000)
        .default(600_000)
        .description('Deadline for one background review job.'),
    maxReviewRecords: z.number().step(1).min(1)
        .default(50)
        .description('Cap for in-memory review-job records; oldest settled records evict first.'),
    maxFileChars: z.number().step(1).min(1)
        .default(12000)
        .description('Character cap for file contents read by gh_file.'),
    maxFindings: z.number().step(1).min(1)
        .default(50)
        .description('Cap for analyzer findings per review.'),
    maxLineLength: z.number().step(1).min(1)
        .default(300)
        .description('Line length beyond which the analyzer flags a long-line finding.'),
    reviewMode: z.union(['static', 'model'])
        .default('static')
        .description('Review engine: static (deterministic analyzer) or model (one-shot subagent through the subagents seam).'),
    modelReviewProvider: z.string()
        .description('Subagent provider name for model review; defaults to the first registered provider.'),
    maxRetries: z.number().step(1).min(0)
        .default(3)
        .description('Maximum 429 retry attempts per GitHub API request.'),
    retryBaseMs: z.number().step(1).min(1)
        .default(500)
        .description('Base backoff for 429 retries (doubles per attempt).'),
    retryMaxWaitMs: z.number().step(1).min(1)
        .default(60_000)
        .description('Ceiling for 429 retry backoff.'),
    requestTimeoutMs: z.number().step(1).min(1000)
        .default(30_000)
        .description('Hard per-request timeout; aborts the fetch when exceeded.'),
    apiBaseUrl: z.string()
        .default('https://api.github.com')
        .description('GitHub REST base URL (change for GitHub Enterprise).'),
    allowedActions: z.array(z.union(CI_ACTION_VALUES))
        .default(['pr.create', 'review.post', 'issue.create', 'issue.comment', 'issue.close', 'pr.merge', 'pr.update', 'ci.run'])
        .description('Write actions this plugin may perform; each still requires approval.'),
    workspaceDir: z.string()
        .description('Working directory for read-only git inspection (defaults to process cwd).'),
    ci: CiConfig
        .description('CI integration: review bot, status-check gate, and the one-shot ci_run tool.'),
});
//# sourceMappingURL=config.js.map