/**
 * Local structural views of the host services dsh-github consumes.
 *
 * The plugin compiles against these minimal interfaces instead of the host's
 * registry types, so the package does not need the host's full type graph at
 * build time. The host objects satisfy them structurally at runtime; every
 * shape below mirrors the documented contract in docs/subsystems/*.md of the
 * supported harness version.
 * @module dsh-github/types
 */
import type { UserMessage } from '@deepseek-ai/dsh-llm/message';
/** Minimal live-agent view: only the members dsh-github touches. */
export interface GithubAgent {
    /** Stable session-scoped id. */
    readonly id: string;
    /** Live driver state; decides followup (idle) vs inject (busy). */
    readonly status: 'idle' | 'running';
    /** Queue context for the next pre-step without waking the driver. */
    inject(message: UserMessage): void;
    /** Queue an ordinary follow-up turn and wake the driver. */
    followup(message: UserMessage): void;
}
/** Input handed to one registered command handler. */
export interface CommandInvocation {
    readonly commandId: string;
    /** Exact agent whose UI received the command. */
    readonly agent: GithubAgent;
    /** Exact text after the command name, including separator whitespace. */
    readonly rawInput: string;
    /** Cancellation signal owned by the dispatching UI request. */
    readonly signal: AbortSignal;
}
/** Outcome rendered directly by the dispatching UI. */
export type CommandResult = {
    readonly kind: 'success';
    readonly text?: string;
    readonly sourceEventSeq?: number;
} | {
    readonly kind: 'error';
    readonly text: string;
};
/** Plugin-authored command registration (structural mirror of dsh-commands). */
export interface CommandDefinition {
    readonly name: string;
    readonly description: string;
    readonly input?: {
        readonly hint: string;
    };
    readonly recordInput?: boolean;
    readonly handler: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult>;
}
/** Human-command registry subset used by dsh-github. */
export interface CommandsService {
    register(definition: CommandDefinition): () => void;
}
/** Registry-issued background-job id; the host generates `<kind>-N` strings. */
export type GithubJobId = string & {
    readonly __githubJobId: unique symbol;
};
/** Terminal result a review-job producer supplies through its hooks. */
export interface JobOutcome {
    status: 'completed' | 'killed' | 'failed';
    detail?: string;
    /** Final output for final-output-only jobs. */
    output?: string;
}
/** Producer hooks through which the job runtime controls the work. */
export interface JobHooks {
    cancel(reason?: string): void;
    done: Promise<JobOutcome>;
}
/** Producer declaration passed to the job registry's start. */
export interface JobStartSpec {
    /** Producer kind — also the id prefix; the host treats kinds as opaque. */
    kind: string;
    /** One-line model-facing label. */
    label: string;
    outputLimitBytes?: number;
    owner?: GithubAgent;
    run(): JobHooks;
}
/** Read-only projection of one job. */
export interface JobSnapshot {
    id: string;
    kind: string;
    label: string;
    status: 'running' | 'stopping' | 'completed' | 'killed' | 'failed';
    detail?: string;
    startedAt: number;
    finishedAt?: number;
    reported: boolean;
}
/** Background-job registry subset used by dsh-github. */
export interface JobRegistry {
    start(spec: JobStartSpec): GithubJobId;
    kill(id: string, caller?: GithubAgent, reason?: string): 'requested' | 'already-finished';
    get(id: string, caller?: GithubAgent): JobSnapshot;
}
/** Closed approval outcomes; `allowed-once` is the only grant. */
export type ApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable';
/** Readonly same-process permission question. */
export interface ApprovalRequest {
    readonly agent: GithubAgent;
    readonly toolName: string;
    readonly callId?: string;
    readonly reason?: string;
    readonly signal?: AbortSignal;
}
/** Approval dispatch service subset used by dsh-github. */
export interface ApprovalService {
    request(req: ApprovalRequest): Promise<ApprovalOutcome>;
}
/** Terminal result of one one-shot subagent run (model review). */
export interface SubagentResultView {
    readonly output: Array<{
        type: string;
        text?: string;
    }>;
    readonly stopReason: string;
}
/** One-shot subagent run handle (model review). */
export interface SubagentRunView {
    readonly result: Promise<SubagentResultView>;
    dispose(): Promise<void>;
}
/** Host subagent seam subset used by dsh-github's model review. */
export interface SubagentsService {
    list(): string[];
    start(name: string, request: {
        label?: string;
        prompt: Array<{
            type: 'text';
            text: string;
        }>;
        parent: GithubAgent;
        signal: AbortSignal;
    }): Promise<SubagentRunView>;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        commands: CommandsService;
        jobs: JobRegistry;
        approval: ApprovalService;
        subagents?: SubagentsService;
    }
}
//# sourceMappingURL=types.d.ts.map