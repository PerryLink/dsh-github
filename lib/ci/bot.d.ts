/**
 * The PR review bot: a poll-driven scanner that reviews open pull requests
 * with the shared CI pipeline and posts idempotent inline comments plus the
 * status-check gate.
 *
 * Polling is the transport: a webhook endpoint would need a public listener
 * (out of scope for a plugin), so the bot re-scans open PRs on
 * `ci.pollIntervalMs` and treats every pass as event delivery — the pipeline's
 * check-run + review-marker idempotency makes repeat deliveries harmless.
 * `/ci scan` delivers the same "event" on demand. Concurrency inside one scan
 * is capped by `ci.maxConcurrent`.
 *
 * Bot writes are plugin-internal automation, not model tool calls: they do
 * not traverse the approval gate. They are switched by `ci.enabled` and
 * scoped to exactly two GitHub surfaces — review comments and check runs —
 * with the minimal-permission token resolved per operation.
 * @module dsh-github/ci/bot
 */
import type { Context } from '@deepseek-ai/cordis';
import type { CommandsService } from '../types.ts';
import type { GithubState } from '../state.ts';
/** Live bot status surfaced by `/ci status`. */
export interface CiBotStatus {
    polling: boolean;
    scanning: boolean;
    intervalMs: number;
    lastScanAt: number | null;
    lastScanPrs: number;
    lastScanNeedsChanges: number;
    lastScanErrors: number;
    lastScanSummary: string;
}
/** Shared bot state; one instance per plugin fiber. */
export interface CiBot {
    status(): CiBotStatus;
    scan(signal?: AbortSignal): Promise<string>;
    setPolling(enabled: boolean): void;
    dispose(): void;
}
/**
 * Create the polling bot and register the `/ci` command family. Everything
 * here is an effect of the calling fiber — disposing the plugin stops the
 * interval and removes the commands.
 * @param ctx - plugin context (owns the effect lifetime).
 * @param commands - the host command registry.
 * @param state - shared plugin state.
 * @returns the bot handle (also returned by the effect disposer path).
 */
export declare function registerCiBot(ctx: Context, commands: CommandsService, state: GithubState): () => void;
//# sourceMappingURL=bot.d.ts.map