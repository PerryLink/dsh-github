/** Runs one git command with stdout captured; injectable for tests. */
export type GitRunner = (args: string[], options: {
    cwd: string;
    signal?: AbortSignal;
}) => Promise<{
    stdout: string;
}>;
/** Read-only snapshot of the git state a PR draft needs. */
export interface GitState {
    /** Current branch, or null outside a repository. */
    branch: string | null;
    /** Whether the working tree has uncommitted changes. */
    hasChanges: boolean;
    /** Porcelain status lines, capped. */
    changedFiles: string[];
    /** Oneline log of commits ahead of the upstream (or the latest commits). */
    commitsAhead: string[];
    /** `origin` remote URL, when configured. */
    remote: string | null;
    /** `owner/repo` parsed from the origin URL, when parseable. */
    repoFromRemote: string | null;
    /** First read failure that stopped collection; the rest stays partial. */
    error?: string;
}
/** Run the real git CLI with stdout captured (never logged). */
export declare function runGitCli(args: string[], options: {
    cwd: string;
    signal?: AbortSignal;
}): Promise<{
    stdout: string;
}>;
/**
 * Parse `owner/repo` out of common origin URL forms (https, ssh, git), for any
 * GitHub host. The host must match `apiHost` (the configured REST base's
 * hostname; `github.com` by default), so a GitHub Enterprise checkout resolves
 * against its own API without accepting an unrelated host.
 * @param remote - raw `git remote get-url origin` output.
 * @param apiHost - expected hostname (lowercased), e.g. `github.com` or `git.example.com`.
 * @returns `owner/repo`, or null when the URL is unparseable or foreign.
 */
export declare function repoFromRemoteUrl(remote: string, apiHost?: string): string | null;
/**
 * Collect the read-only git facts a PR draft needs, tolerating partial
 * failures: each command that fails records `error` and stops collection.
 * @param cwd - repository working directory.
 * @param runGit - git CLI runner; the real one by default.
 * @param signal - cancels collection.
 * @param apiHost - expected origin host for `owner/repo` parsing (`github.com` by default).
 * @returns the collected snapshot.
 */
export declare function readGitState(cwd: string, runGit?: GitRunner, signal?: AbortSignal, apiHost?: string): Promise<GitState>;
//# sourceMappingURL=git.d.ts.map