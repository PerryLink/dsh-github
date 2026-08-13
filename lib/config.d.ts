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
/** GitHub write actions the plugin may perform (each still requires approval). */
export type GithubAction = 'pr.create' | 'review.post' | 'issue.create';
/** Where a GitHub token is looked up. `auto` tries them in order. */
export type TokenSource = 'auto' | 'credentials' | 'env' | 'gh';
export interface Config {
    /**
     * Token lookup order: `auto` resolves credentials-seam reference → `env`
     * variable → `gh` CLI login, in that order. Explicit values restrict to one
     * source and report a structured error when it is unavailable.
     */
    tokenSource: TokenSource;
    /** Credentials-seam reference / environment-variable name for the token. */
    tokenRef: string;
    /** `owner/repo` used when a call does not name one and git has no origin. */
    defaultOwnerRepo?: string;
    /** Whether `/pr create` may instruct the model to commit and push first. */
    autoCommit: boolean;
    /** Byte cap for PR diffs read into a review (diff or review job). */
    maxDiffChars: number;
    /** Cap for PR comments listed by gh_review. */
    maxComments: number;
    /** Deadline for one background review job; exceeded jobs fail with detail. */
    reviewJobTimeoutMs: number;
    /** Maximum 429 retry attempts per GitHub API request. */
    maxRetries: number;
    /** Base backoff for 429 retries (doubles per attempt). */
    retryBaseMs: number;
    /** Ceiling for 429 retry backoff. */
    retryMaxWaitMs: number;
    /** GitHub REST base URL; change for GitHub Enterprise. */
    apiBaseUrl: string;
    /** Whitelist of write actions; everything else is denied before approval. */
    allowedActions: GithubAction[];
    /** Working directory for read-only git inspection; defaults to the process cwd. */
    workspaceDir?: string;
}
export declare const Config: z<Config>;
//# sourceMappingURL=config.d.ts.map