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
export type GithubAction = 'pr.create' | 'review.post' | 'issue.create' | 'issue.comment' | 'issue.close' | 'pr.merge' | 'pr.update' | 'ci.run';
/** Where a GitHub token is looked up. `auto` tries them in order. */
export type TokenSource = 'auto' | 'credentials' | 'env' | 'gh';
/**
 * The CI surface: the one-shot `ci_run` tool, the polling review bot, the
 * `/ci` command family, and the status-check gate. Every tunable is a Schema
 * key so the composite action can map its inputs 1:1 onto this section.
 */
export interface CiConfig {
    /** Master switch for the CI surface. Defaults to false (interactive use unchanged). */
    enabled: boolean;
    /** Review engine: `static` runs the deterministic analyzer; `model` lets the headless agent author the review body. */
    engine: 'static' | 'model';
    /**
     * Write actions auto-allowed while running as the CI driver
     * (`DSH_GITHUB_CI_DRIVER=1`, unattended). Empty in interactive sessions —
     * there every write still asks the human.
     */
    autoApprove: GithubAction[];
    /** Status-check name published by the CI gate (per PR head commit). */
    checkName: string;
    /** `needs-changes` verdict → check conclusion `failure`; `false` publishes `neutral` instead (non-blocking gate). */
    blocking: boolean;
    /** Lowest severity that flips the verdict to `needs-changes`. */
    failOn: 'error' | 'warning';
    /** Review-bot poll interval; `0` disables polling (manual `/ci scan` still works). */
    pollIntervalMs: number;
    /** Label filters; a PR must carry at least one listed label. Empty = all PRs. */
    labelFilters: string[];
    /** Path filters (globs, e.g. `src/**`); when set, a PR must touch a matching path. Empty = all PRs. */
    pathFilters: string[];
    /** Sensitive-path globs flagged by the sensitive-file rule (error/warning per `sensitiveSeverity`). */
    sensitivePathPatterns: string[];
    /** Severity of the sensitive-file rule. */
    sensitiveSeverity: 'error' | 'warning';
    /** File extensions treated as code by the test-existence rule (with leading dot). */
    codeExtensions: string[];
    /** Path globs treated as tests by the test-existence rule. */
    testPathPatterns: string[];
    /** Scope caps for the change-size rule (`large-change` findings). */
    maxChangedFiles: number;
    maxAddedLines: number;
    maxRemovedLines: number;
    /** Cap of concurrently reviewed PRs inside one bot scan. */
    maxConcurrent: number;
    /** Whether the pipeline posts review comments (inline findings + PR-level body). */
    postComments: boolean;
    /** Report-file directory; defaults to the CI output directory env var, then the workspace dir. */
    reportDir: string;
}
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
    /** Character cap for PR diffs read into a review (diff or review job). */
    maxDiffChars: number;
    /** Character cap for the diff excerpt rendered into tool output. */
    renderExcerptChars: number;
    /** Cap for PR comments listed by gh_review. */
    maxComments: number;
    /** Deadline for one background review job; exceeded jobs fail with detail. */
    reviewJobTimeoutMs: number;
    /** Cap for in-memory review-job records; oldest settled records evict first. */
    maxReviewRecords: number;
    /** Cap for file contents read by gh_file. */
    maxFileChars: number;
    /** Cap for analyzer findings per review. */
    maxFindings: number;
    /** Line length beyond which the analyzer flags a long-line finding. */
    maxLineLength: number;
    /**
     * Review engine: `static` runs the deterministic analyzer; `model` delegates
     * the capped diff to a one-shot subagent through the host's `subagents` seam
     * (the owner agent is the parent). Fails loud when the seam is absent.
     */
    reviewMode: 'static' | 'model';
    /** Subagent provider name for `reviewMode: "model"`; defaults to the first registered. */
    modelReviewProvider?: string;
    /** Maximum 429 retry attempts per GitHub API request. */
    maxRetries: number;
    /** Base backoff for 429 retries (doubles per attempt). */
    retryBaseMs: number;
    /** Ceiling for 429 retry backoff. */
    retryMaxWaitMs: number;
    /** Hard per-request timeout; aborts the fetch when exceeded. */
    requestTimeoutMs: number;
    /** GitHub REST base URL; change for GitHub Enterprise. */
    apiBaseUrl: string;
    /** Whitelist of write actions; everything else is denied before approval. */
    allowedActions: GithubAction[];
    /** Working directory for read-only git inspection; defaults to the process cwd. */
    workspaceDir?: string;
    /** CI integration: bot, gate, and one-shot runner (see {@link CiConfig}). */
    ci: CiConfig;
}
/** Default sensitive-path globs for the sensitive-file rule. */
export declare const DEFAULT_SENSITIVE_PATTERNS: string[];
/** Default code extensions for the test-existence rule (with leading dot). */
export declare const DEFAULT_CODE_EXTENSIONS: string[];
/** Default test-path globs for the test-existence rule. */
export declare const DEFAULT_TEST_PATTERNS: string[];
export declare const CiConfig: z<CiConfig>;
export declare const Config: z<Config>;
//# sourceMappingURL=config.d.ts.map