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
    apiBaseUrl: z.string()
        .default('https://api.github.com')
        .description('GitHub REST base URL (change for GitHub Enterprise).'),
    allowedActions: z.array(z.union(['pr.create', 'review.post', 'issue.create', 'issue.comment', 'issue.close']))
        .default(['pr.create', 'review.post', 'issue.create', 'issue.comment', 'issue.close'])
        .description('Write actions this plugin may perform; each still requires approval.'),
    workspaceDir: z.string()
        .description('Working directory for read-only git inspection (defaults to process cwd).'),
});
//# sourceMappingURL=config.js.map