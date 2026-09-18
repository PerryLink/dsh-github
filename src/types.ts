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
import type { UserMessage } from '@deepseek-ai/dsh-llm/message'
import type { JobId, JobStart } from '@deepseek-ai/dsh-jobs'
import type { SubagentRun, SubagentStartRequest } from '@deepseek-ai/dsh-subagent'

declare module '@deepseek-ai/dsh-jobs' {
  interface JobKindMap {
    /** The plugin's background review-job producer kind (`github-review-N` ids). */
    'github-review': 'github-review'
  }
}

/** Minimal live-agent view: only the members dsh-github touches. */
export interface GithubAgent {
  /** Stable session-scoped id. */
  readonly id: string
  /** Live driver state; decides followup (idle) vs inject (busy). */
  readonly status: 'idle' | 'running'
  /** Queue context for the next pre-step without waking the driver. */
  inject(message: UserMessage): void
  /** Queue an ordinary follow-up turn and wake the driver. */
  followup(message: UserMessage): void
}

/** Input handed to one registered command handler. */
export interface CommandInvocation {
  readonly commandId: string
  /** Exact agent whose UI received the command. */
  readonly agent: GithubAgent
  /** Exact text after the command name, including separator whitespace. */
  readonly rawInput: string
  /** Cancellation signal owned by the dispatching UI request. */
  readonly signal: AbortSignal
}

/** Outcome rendered directly by the dispatching UI. */
export type CommandResult =
  | { readonly kind: 'success'; readonly text?: string; readonly sourceEventSeq?: number }
  | { readonly kind: 'error'; readonly text: string }

/** Plugin-authored command registration (structural mirror of dsh-commands). */
export interface CommandDefinition {
  readonly name: string
  readonly description: string
  readonly input?: { readonly hint: string }
  readonly recordInput?: boolean
  readonly handler: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult>
}

/** Human-command registry subset used by dsh-github. */
export interface CommandsService {
  register(definition: CommandDefinition): () => void
}

/** Registry-issued background-job id (the official branded `JobId`). */
export type GithubJobId = JobId

/** Producer declaration passed to the job registry's start (official `JobStart`). */
export type JobStartSpec = JobStart

/** Re-export the official job seam faces the plugin consumes. */
export type {
  JobHooks,
  JobOutcome,
  JobSnapshot,
  JobRegistry,
} from '@deepseek-ai/dsh-jobs'

/** Closed approval outcomes; `allowed-once` is the only grant. */
export type ApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

/** Readonly same-process permission question. */
export interface ApprovalRequest {
  readonly agent: GithubAgent
  readonly toolName: string
  readonly callId?: string
  readonly reason?: string
  readonly signal?: AbortSignal
}

/** Approval dispatch service subset used by dsh-github. */
export interface ApprovalService {
  request(req: ApprovalRequest): Promise<ApprovalOutcome>
}

/** Host subagent seam subset used by dsh-github's model review: the official
 * run/request faces, with the plugin's minimal agent view as the parent. */
export interface SubagentsService {
  list(): string[]
  start(
    name: string,
    request: Omit<SubagentStartRequest, 'parent'> & { parent: GithubAgent },
  ): Promise<SubagentRun>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    commands: CommandsService
    approval: ApprovalService
  }
}
