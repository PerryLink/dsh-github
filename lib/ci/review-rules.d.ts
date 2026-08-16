/**
 * PR-level review rules for the CI pipeline: change scope, test existence,
 * and sensitive files. Line-level findings stay in src/review.ts; these rules
 * reason about the pull request as a whole (file list, totals) and produce
 * findings anchored to a file (`line: null`) or to the PR itself (`file: ''`).
 *
 * The rules are deterministic and model-free — the same review runs in the
 * polling bot, the headless action, and the one-shot `ci_run` tool with
 * identical output.
 * @module dsh-github/ci/review-rules
 */
import type { Finding } from '../review.ts';
import type { CiConfig } from '../config.ts';
/** One changed file's stats, as reported by the PR files endpoint. */
export interface ChangedFileStat {
    path: string;
    added: number;
    removed: number;
}
/** Facts the PR-level rules reason over. */
export interface PrReviewInput {
    /** Changed files with per-file added/removed counts. */
    files: ChangedFileStat[];
    /** PR-wide added/removed line totals. */
    additions: number;
    deletions: number;
    /** Tunable rule options from the CI config. */
    options: Pick<CiConfig, 'sensitivePathPatterns' | 'sensitiveSeverity' | 'codeExtensions' | 'testPathPatterns' | 'maxChangedFiles' | 'maxAddedLines' | 'maxRemovedLines'>;
}
/**
 * Translate one glob into an anchored RegExp supporting `*`, `**`, and `?`.
 * A pattern without a `/` is a basename glob and matches at any depth
 * (`.env` matches `config/.env`, `*.pem` matches `certs/server.pem`);
 * patterns containing `/` match against the whole repository path.
 */
export declare function globToRegExp(pattern: string): RegExp;
/** Whether a repository path matches any of the configured globs. */
export declare function matchesAnyGlob(path: string, patterns: readonly string[]): boolean;
/** PR-level findings for one pull request; deterministic and ordered. */
export declare function analyzePr(input: PrReviewInput): Finding[];
//# sourceMappingURL=review-rules.d.ts.map