/**
 * Deterministic multi-file PR analyzer: parses a unified diff and produces a
 * structured finding list plus a ready-to-post Markdown comment body.
 *
 * The analyzer is intentionally model-free — it runs inside the background
 * review job without spending tokens, is deterministic, and its output is the
 * only content the `/review post` approval offers for posting. For an LLM
 * review instead, configure `reviewMode: "model"` (src/jobs.ts delegates the
 * capped diff to a one-shot subagent through the host's subagents seam).
 * @module dsh-github/review
 */
export type FindingSeverity = 'info' | 'warning' | 'error';
/** One review finding anchored to a file (and a new-file line when known). */
export interface Finding {
    file: string;
    line: number | null;
    severity: FindingSeverity;
    /** Short stable rule id, shown in the posted comment. */
    rule: string;
    message: string;
}
/** Complete review result: findings, summary text, and the postable body. */
export interface ReviewReport {
    findings: Finding[];
    summary: string;
    postBody: string;
    /** Whether the analyzed diff exceeded the cap and was truncated. */
    truncated: boolean;
}
/** Tunables for the analyzer; every key has a config counterpart. */
export interface AnalyzerOptions {
    /** Cap for findings per review. Defaults to 50. */
    maxFindings?: number;
    /** Line length beyond which a long-line finding is raised. Defaults to 300. */
    maxLineLength?: number;
}
/** Split a unified diff into per-file added lines with new-file line numbers. */
export declare function parseAddedLines(diff: string, maxChars: number): Array<{
    file: string;
    line: number;
    text: string;
}>;
/** Per-file change sizes parsed from a unified diff. */
export interface DiffFileStat {
    path: string;
    added: number;
    removed: number;
}
/** Parse per-file added/removed counts out of a unified diff. */
export declare function parseDiffStats(diff: string, maxChars: number): DiffFileStat[];
/**
 * Analyze a unified diff into findings and a postable comment body.
 * @param diff - unified diff text (already capped by the caller or capped here).
 * @param maxChars - character cap applied before parsing.
 * @param options - analyzer tunables; defaults mirror the config defaults.
 * @returns findings (capped), one-line summary, and Markdown post body.
 */
export declare function analyzeDiff(diff: string, maxChars: number, options?: AnalyzerOptions): ReviewReport;
/** Markdown comment body grouped by file, ready for a PR issue comment. */
export declare function formatPostBody(findings: readonly Finding[], truncated: boolean): string;
//# sourceMappingURL=review.d.ts.map