/**
 * Test scaffolding: real Cordis contexts with mock service providers for the
 * five services dsh-github injects, plus a fake agent, fetch, git, and gh
 * runners. No test touches the network or a real shell.
 * @module dsh-github/test/helpers
 */
import { Context } from '@deepseek-ai/cordis'
import { Config, applyWithDeps, type PluginConfig } from '../src/index.ts'
import type { ApprovalOutcome, ApprovalRequest, CommandInvocation, CommandResult, JobHooks, JobStartSpec } from '../src/types.ts'

/** Fake agent implementing the minimal structural view dsh-github consumes. */
export class MockAgent {
  id = 'session-1'
  status: 'idle' | 'running' = 'idle'
  injected: Array<{ text: string; summary: string }> = []
  followed: Array<{ text: string; summary: string }> = []

  inject(message: { content: Array<{ text: string }>; source: { summary: string } }): void {
    this.injected.push({ text: message.content.map(block => block.text).join('\n'), summary: message.source.summary })
  }

  followup(message: { content: Array<{ text: string }>; source: { summary: string } }): void {
    this.followed.push({ text: message.content.map(block => block.text).join('\n'), summary: message.source.summary })
  }
}

/** Tool registry mock: captures definitions and runs them like the host. */
export class MockTools {
  defs = new Map<string, {
    name: string
    description: string
    parameters: unknown
    output: { schema: unknown; render: (args: unknown, value: unknown) => unknown; presentationMeta?: (args: unknown, value: unknown) => unknown }
    execute: (args: unknown, exec: unknown) => Promise<unknown>
    presentCall?: (args: unknown) => unknown
    presentResult?: (args: unknown, result: unknown) => unknown
    isConcurrencySafe?: (args: unknown) => boolean
  }>()

  register(definition: MockTools['defs'] extends Map<string, infer V> ? V : never): () => void {
    this.defs.set(definition.name, definition)
    return () => {
      this.defs.delete(definition.name)
    }
  }

  get(name: string) {
    const def = this.defs.get(name)
    if (def === undefined) throw new Error(`unknown tool ${name}`)
    return def
  }

  /** Run one registered tool exactly like the registry dispatches execute. */
  async run(name: string, args: unknown, agent?: MockAgent, signal?: AbortSignal): Promise<unknown> {
    const def = this.get(name)
    return def.execute(args, {
      callId: 'call-1',
      name,
      arguments: args,
      agent,
      signal: signal ?? new AbortController().signal,
      token: Symbol('token'),
    })
  }
}

/** Command registry mock: captures definitions and runs handlers. */
export class MockCommands {
  defs = new Map<string, {
    name: string
    description: string
    input?: { hint: string }
    handler: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult>
  }>()

  register(definition: MockCommands['defs'] extends Map<string, infer V> ? V : never): () => void {
    this.defs.set(definition.name, definition)
    return () => {
      this.defs.delete(definition.name)
    }
  }

  async run(name: string, rawInput: string, agent: MockAgent, signal?: AbortSignal): Promise<CommandResult> {
    const def = this.defs.get(name)
    if (def === undefined) throw new Error(`unknown command ${name}`)
    return def.handler({ commandId: 'cmd-1', agent, rawInput, signal: signal ?? new AbortController().signal })
  }
}

interface JobRecord {
  spec: JobStartSpec
  hooks: JobHooks
  state: 'running' | 'stopping' | 'completed' | 'killed' | 'failed'
}

/** Job registry mock implementing start/kill/get semantics. */
export class MockJobs {
  nextId = 1
  records = new Map<string, JobRecord>()
  startCalls: JobStartSpec[] = []
  refuseStart = false

  start(spec: JobStartSpec): string {
    if (this.refuseStart) throw new Error('background jobs unavailable: no job controller serves this agent')
    this.startCalls.push(spec)
    const id = `${spec.kind}-${this.nextId}`
    this.nextId += 1
    const record: JobRecord = { spec, hooks: spec.run(), state: 'running' }
    void record.hooks.done.then((outcome) => {
      record.state = outcome.status
    })
    this.records.set(id, record)
    return id
  }

  kill(id: string, _caller?: unknown, reason?: string): 'requested' | 'already-finished' {
    const record = this.records.get(id)
    if (record === undefined) throw new Error(`unknown job ${id}`)
    if (record.state !== 'running') return 'already-finished'
    record.state = 'stopping'
    record.hooks.cancel(reason)
    return 'requested'
  }

  get(id: string): JobRecord['state'] {
    const record = this.records.get(id)
    if (record === undefined) throw new Error(`unknown job ${id}`)
    return record.state
  }

  hooks(id: string): JobHooks {
    const record = this.records.get(id)
    if (record === undefined) throw new Error(`unknown job ${id}`)
    return record.hooks
  }

  spec(id: string): JobStartSpec {
    const record = this.records.get(id)
    if (record === undefined) throw new Error(`unknown job ${id}`)
    return record.spec
  }
}

/** Approval mock: records requests and returns a scripted outcome. */
export class MockApproval {
  requests: ApprovalRequest[] = []
  nextOutcome: ApprovalOutcome = 'allowed-once'

  async request(req: ApprovalRequest): Promise<ApprovalOutcome> {
    this.requests.push(req)
    return this.nextOutcome
  }
}

/** Credentials mock: resolves from a Map keyed by the reference. */
export class MockCredentials {
  values = new Map<string, string>()

  async resolve(ref: string): Promise<{ value: string; source: string } | undefined> {
    const value = this.values.get(String(ref))
    return value === undefined ? undefined : { value, source: 'env' }
  }
}

/** All mock services plus the hosting context. */
export interface TestServices {
  ctx: Context
  tools: MockTools
  commands: MockCommands
  jobs: MockJobs
  approval: MockApproval
  credentials: MockCredentials
}

/** Build a context with all five mocked services provided. */
export function makeServices(): TestServices {
  const ctx = new Context()
  const tools = new MockTools()
  const commands = new MockCommands()
  const jobs = new MockJobs()
  const approval = new MockApproval()
  const credentials = new MockCredentials()
  ctx.provide('tools', tools)
  ctx.provide('commands', commands)
  ctx.provide('jobs', jobs)
  ctx.provide('approval', approval)
  ctx.provide('credentials', credentials)
  return { ctx, tools, commands, jobs, approval, credentials }
}

export interface LoadOptions {
  config?: Partial<PluginConfig>
  runGit?: (args: string[], options: { cwd: string; signal?: AbortSignal }) => Promise<{ stdout: string }>
  runGh?: (args: string[], signal?: AbortSignal) => Promise<{ stdout: string }>
  fetchImpl?: typeof fetch
}

/** Resolve config through the schema (load-time validation), then apply. */
export async function loadPlugin(services: TestServices, options: LoadOptions = {}): Promise<() => void> {
  const config = Config(options.config ?? {}) as PluginConfig
  const fiber = services.ctx.plugin({
    name: 'dsh-github',
    inject: ['tools', 'commands', 'jobs', 'approval', 'credentials'],
    apply: (ctx: Context, resolved: PluginConfig) => applyWithDeps(ctx, resolved, {
      ...options.runGit !== undefined ? { runGit: options.runGit } : {},
      ...options.runGh !== undefined ? { runGh: options.runGh } : {},
      ...options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {},
    }),
  }, config)
  return () => void fiber.dispose()
}

/** Make a fetch Response from a status and JSON/text body. */
export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

export function textResponse(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain', ...headers } })
}

/** A tiny fetch stub dispatching on (method, pathname, init headers). */
export function stubFetch(routes: Array<{
  match: (method: string, url: URL, init?: RequestInit) => boolean
  respond: () => Response
}>): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
    const method = init?.method ?? 'GET'
    for (const route of routes) {
      if (route.match(method, url, init)) return route.respond()
    }
    return jsonResponse(404, { message: `no stub for ${method} ${url.pathname}` })
  }) as typeof fetch
}

export const TOKEN = 'ghp_test_token_0123456789abcdef'
