import { GithubClient, clientOptionsFromConfig } from "./github.js";
import { repoFromRemoteUrl } from "./git.js";
import { resolveToken } from "./credential.js";
const REPO_GUIDANCE = 'Name the repository with the ownerRepo parameter, set defaultOwnerRepo in cordis.yml, or run inside a checkout with a GitHub origin remote.';
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
/**
 * Create the shared plugin state. Called once per plugin instance (per
 * cordis.yml row); config hot-reload creates a fresh instance.
 * @param ctx - context holding the credentials seam and (optionally) the subagent seam.
 * @param config - validated configuration.
 * @param runGit - read-only git runner (injectable in tests).
 * @param runGh - gh CLI runner (injectable in tests).
 * @param fetchImpl - fetch implementation (injectable in tests).
 */
export function createState(ctx, config, runGit, runGh, fetchImpl) {
    const clientOptions = clientOptionsFromConfig(config, fetchImpl);
    const apiHost = new URL(config.apiBaseUrl).hostname.toLowerCase();
    const records = new Map();
    const state = {
        config,
        credentials: ctx.credentials,
        subagents: ctx.subagents,
        records,
        runGit,
        runGh,
        workspaceDir: config.workspaceDir ?? process.cwd(),
        apiHost,
        resolveToken: (signal) => resolveToken(ctx.credentials, config.tokenSource, config.tokenRef, runGh, signal),
        client: (token) => new GithubClient(token, clientOptions),
        resolveRepo: (ownerRepo, signal) => resolveRepo(state, ownerRepo, signal),
        parsePrRef: parsePrRef,
        rememberRecord: (id, record) => {
            records.set(id, record);
            while (records.size > config.maxReviewRecords) {
                const oldestSettled = [...records.entries()].find(([, item]) => item.status !== 'running');
                if (oldestSettled === undefined)
                    break; // every record is running; the cap is best-effort.
                records.delete(oldestSettled[0]);
            }
        },
    };
    return state;
}
/** Resolve the target repository: explicit value → config fallback → git origin. */
export async function resolveRepo(state, ownerRepo, signal) {
    const candidate = ownerRepo?.trim();
    if (candidate !== undefined && candidate.length > 0) {
        return REPO_PATTERN.test(candidate)
            ? { ok: true, repo: candidate }
            : { ok: false, code: 'invalid-repo', message: `"${candidate}" is not an owner/repo pair`, guidance: REPO_GUIDANCE };
    }
    const fallback = state.config.defaultOwnerRepo?.trim();
    if (fallback !== undefined && fallback.length > 0)
        return { ok: true, repo: fallback };
    const { repoFromRemote } = await runGitRemote(state, state.workspaceDir, signal);
    if (repoFromRemote !== null)
        return { ok: true, repo: repoFromRemote };
    return { ok: false, code: 'repo-unknown', message: 'could not determine the target repository', guidance: REPO_GUIDANCE };
}
/** Parses PR references: `123`, `#123`, `owner/repo#123`, or a pull URL. */
export function parsePrRef(input) {
    const trimmed = input.trim();
    const urlMatch = /^https?:\/\/[^/]+\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/pull\/(\d+)\/?$/.exec(trimmed);
    if (urlMatch)
        return { number: Number(urlMatch[2]), repo: urlMatch[1] };
    const hashMatch = /^(?:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+))?#(\d+)$/.exec(trimmed);
    if (hashMatch)
        return hashMatch[1] === undefined ? { number: Number(hashMatch[2]) } : { number: Number(hashMatch[2]), repo: hashMatch[1] };
    if (/^\d+$/.test(trimmed))
        return { number: Number(trimmed) };
    return null;
}
/** Read the git origin URL through the injected runner. */
async function runGitRemote(state, cwd, signal) {
    try {
        const { stdout } = await state.runGit(['remote', 'get-url', 'origin'], { cwd, signal });
        return { repoFromRemote: repoFromRemoteUrl(stdout, state.apiHost) };
    }
    catch {
        return { repoFromRemote: null };
    }
}
export function rateLimitValue(info) {
    return { remaining: info.remaining, resetAt: info.resetAt };
}
//# sourceMappingURL=state.js.map