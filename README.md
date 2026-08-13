# dsh-github

GitHub integration for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): create pull requests, review PRs with background jobs, and read issues — **every write is gated by human approval**, and the token never leaves the credential layer.

| | |
|---|---|
| Tools | `pr_create` · `gh_review` · `gh_issue` · `review_post` · `issue_open` |
| Commands | `/pr create [title]` · `/review <pr>` · `/review stop <jobId>` · `/review post <jobId>` · `/issue open <title>` |
| Host | dsh `0.1.0-rc.6` web profile (works with any profile built on `dsh-base`) |
| Peers | `@deepseek-ai/cordis ^4.0.1` · `schemastery ^3.18.1` · `dsh-tools/dsh-llm/dsh-session/dsh-scope/dsh-credentials ^0.1.0-rc.5` |

[中文](README.zh.md)

## One-paragraph acceptance

Install the plugin, configure a token, and an agent can **read a PR** (`gh_review`), **review it in the background** (`/review` + the built-in `job_list`/`job_output`/`job_kill` tools), and **open a PR** (`/pr create` → the model calls `pr_create` under approval). Humans control everything through slash commands and the approval prompt; every write is auditable; the token never appears in model-visible text, session events, or logs.

## Architecture

```
                    ┌───────────────────────────────────────────────┐
                    │                   dsh-github                  │
                    │                                               │
 humans ─── /pr ────┼──► git reader (read-only) ──► agent.followup  │
         /review ───┼──► ctx.jobs.start("github-review") ──► job    │
         /issue ────┼──► agent.followup                              │
                    │                                               │
 model ─── pr_create / gh_review / gh_issue / review_post /         │
           issue_open (defineTool, canonical JSON only)             │
                    │                                               │
                    └───────┬───────────────┬───────────────┬───────┘
                            │               │               │
                  tools/pre-execute     credential        GitHub REST
                  approval gate        resolution        client (fetch,
                  (ask | deny)      (seam → env →       429 retry,
                                    gh CLI, per-op)     rate-limit)
```

- **Credential seam (F1/F2/S2).** `tokenSource: auto` resolves per operation in the order credentials seam (`GITHUB_TOKEN` reference) → environment variable → `gh` CLI token. The value is a local variable handed to the REST client; it never enters canonical values, renders, cards, command outputs, injected notices, job output, approval reasons, or error messages. Without a token every tool returns a structured `{ status: 'error', code: 'no-token', guidance }` value instead of crashing.
- **Approval (S1).** All writes flow through model tools. A `tools/pre-execute` waterfall listener returns `ask` for `pr_create` / `review_post` / `issue_open`, so the registry asks the human through `ctx.approval` (audit pair `approval/asked` + `approval/decided` is logged by the host) and fails closed without an answerer. Actions outside the `allowedActions` whitelist are denied before prompting. Commands never write directly: command handlers run with no open turn, so `ctx.approval.request` is structurally closed to them — a write command gathers read-only context, then wakes the agent (`followup` when idle, `inject` when busy) so the model runs the gated tool inside a turn.
- **Background review (F7/F8).** `/review <pr>` starts a `github-review` job on `ctx.jobs` (label, owner, timeout, cancelable). The job resolves the token per operation, fetches the capped diff, and runs a deterministic multi-file analyzer (`src/review.ts`: secrets, debug artifacts, eval, TODO markers, long lines, oversized changes) — no tokens spent, fully testable. Completion notices reach the initiating session through the host's `dsh-tool-jobs` consumer; the model reads the report via the existing `job_output` tool and publishes it with `review_post` — approval required. `/review stop <jobId>` kills the job; the plugin never writes to GitHub from the job itself.
- **Model-visible ⟺ logged (N3).** The plugin appends **no custom session event types**. Out-of-repo event types are not in the host's `KNOWN_SESSION_EVENT_TYPES`, so an unknown required event would make the session log unreadable after plugin removal (the host deliberately defers a registration surface for external plugins). All model-visible content therefore flows through host-logged surfaces: `tool/result` canonical values, `user/message` notices via `agent.inject`/`agent.followup`, the `command/run` + `command/done` lifecycle pair, and the `approval/asked` + `approval/decided` audit pair. Everything the model can see is reconstructable from the session log.
- **Presenters are pure (F5).** `presentCall`/`presentResult` are pure functions of `args` (+ the persisted `result.meta`, projected by `presentationMeta`); they run identically on replay. PR creation shows a generic card with the PR URL.
- **429 and quotas (S3).** The REST client retries 429s honoring `Retry-After`/`x-ratelimit-reset` with capped exponential backoff (`maxRetries`, `retryBaseMs`, `retryMaxWaitMs`), and every read result carries `rateLimit: { remaining, resetAt }` so the model sees the remaining quota. Read tools are concurrency-safe; write tools are not.

## Configuration

Schemastery-validated at load time (fail loud); defaults below. Override any key in the profile's `cordis.patch.yml` (the whole `dsh-github` row config is replaced, not deep-merged).

| Key | Default | Meaning |
|---|---|---|
| `tokenSource` | `auto` | `auto` (credentials → env → gh) or one of `credentials` / `env` / `gh` |
| `tokenRef` | `GITHUB_TOKEN` | Credential-seam reference / environment-variable name |
| `defaultOwnerRepo` | — | Fallback `owner/repo` when a call names none and git has no origin |
| `autoCommit` | `false` | Whether `/pr create` may instruct the model to commit+push first (writes still go through bash approval) |
| `maxDiffChars` | `8000` | Cap for PR diffs read into reviews |
| `maxComments` | `20` | Cap for PR comments listed by `gh_review` |
| `reviewJobTimeoutMs` | `600000` | Deadline for one background review job (fails with `timeout`) |
| `maxRetries` | `3` | 429 retry attempts per request |
| `retryBaseMs` | `500` | Retry backoff base (doubles per attempt) |
| `retryMaxWaitMs` | `60000` | Retry backoff ceiling |
| `apiBaseUrl` | `https://api.github.com` | GitHub REST base URL (GitHub Enterprise) |
| `allowedActions` | `['pr.create','review.post','issue.create']` | Write-action whitelist; anything else is denied before approval |
| `workspaceDir` | process cwd | Working directory for read-only git inspection |

## Tools

| Tool | Kind | Parameters | Returns |
|---|---|---|---|
| `pr_create` | write | `title*`, `body?`, `base?`, `head?`, `draft?`, `ownerRepo?` | `{status:'created', url, number, title, state, draft, base, head}` or structured error |
| `gh_review` | read | `pr*` (number / `#n` / `o/r#n` / URL), `fields?`, `maxDiffChars?` | metadata, diff (capped, with excerpt + per-file stats), comments, CI, static findings, rate limit |
| `gh_issue` | read | `action*` (`list`/`get`/`comments`), `ownerRepo?`, `issueNumber?`, `state?`, `limit?` | normalized issue items + rate limit |
| `review_post` | write | `jobId*` | `{status:'posted', url, commentId, findings}` or structured error |
| `issue_open` | write | `title*`, `body?`, `labels?`, `ownerRepo?` | `{status:'created', url, number, title}` or structured error |

`execute` returns only the canonical JSON declared by `output.schema`; missing-token and GitHub-API failures are structured error variants, infrastructure failures throw (→ `isError`). `exec.signal` is honored everywhere.

## Commands

| Command | Effect |
|---|---|
| `/pr create [title]` | Reads git state (branch, changed files, commits ahead, origin) and queues a `pr_create` instruction for the model (draft body, defaults, no commit/push unless `autoCommit`). Creating the PR asks for approval. |
| `/review <pr>` | Starts a background review job; prints the job id. Completion is announced by the host; read it with `job_output`. |
| `/review stop <jobId>` | Cancels the job (local control, no GitHub write). |
| `/review post <jobId>` | Queues a `review_post` instruction for the model; posting asks for approval. |
| `/issue open <title>` | Queues an `issue_open` instruction for the model; creating asks for approval. |

## Installation

Three channels, all documented here; pick one.

### 1. npm tarball (no build permission needed)

```sh
pnpm pack                          # produces dsh-github-0.1.0.tgz with lib/ built in
dsh plugin --profile <name> add ./dsh-github-0.1.0.tgz
```

### 2. git source (needs `prepare` + `allowBuilds`)

```sh
dsh plugin --profile <name> add "github:owner/dsh-github#<sha>"
```

pnpm ≥10 refuses to run a git dependency's `prepare` until allowlisted; `dsh` prints the exact key — copy it into the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-github: true
```

The `prepare` script (`scripts/prepare.mjs`) is self-contained: it builds with TypeScript when a compiler is resolvable, otherwise falls back to the `lib/` artifacts committed in the repository, and fails loud with neither. Pin the commit; allowlisting a build means trusting the source to run code on your machine at install time.

### 3. local link (development)

```sh
pnpm link --dir <this repo>
dsh plugin --profile <name> add dsh-github
```

or add an insert row pointing at the checkout into the profile's `cordis.patch.yml` (`name: /absolute/path/to/dsh-github/src/index.ts` under the tsx source launcher, or the built `lib/index.js`).

**Uninstall:** `dsh plugin --profile <name> remove dsh-github`, then remove the row from the profile `cordis.patch.yml` if you installed via a manual insert.

**Verify:** `dsh --profile <name> --dump-config` must show the `dsh-github` row under its own `# == dsh-github` section with no `FAILED` lines, and the startup log must be free of FAILED entries.

## Security boundaries

- The token exists only inside the credential resolution result and the REST client's Authorization header. It is never logged, never rendered, never injected, never appended to the session log.
- Every GitHub write (`pr_create`, `review_post`, `issue_open`) requires `allowed-once` from `ctx.approval` (default policy `ask`); `rejected`, `cancelled`, and `unavailable` all fail closed.
- `/pr create` never commits or pushes by itself; with `autoCommit: true` the model performs those writes through the bash tool's own approval gate. dsh-github does **not** manage git identity (dsh-git-identity's job) or worktrees (dsh-worktree's job).
- The review job performs no writes: it reads a diff and stores a report in process memory; only `review_post` publishes, after approval.
- Rate limits: 429s are retried with backoff and the remaining quota is surfaced to the model.

## Known limitations

- **No custom session events.** Deliberate: see "Model-visible ⟺ logged". Audit trails rely on the host's own event vocabulary (`tool/result`, `user/message`, `command/run`+`command/done`, `approval/asked`+`approval/decided`).
- **Static analyzer, not a model reviewer.** The review job runs a deterministic rule set (`src/review.ts`) so it is token-free and reproducible; a model-based review pass through the subagent seam is a documented v2 extension point.
- **One aggregated comment.** `review_post` publishes the review as a single PR issue-level comment rather than inline per-line review comments (line-anchored review comments are v2).
- **Jobs and records are process-local.** The review report lives in plugin memory keyed by job id, matching the host job registry's process-local lifetime; both die together on plugin reload/restart.
- **npm `latest` dist-tags are stale.** The `@deepseek-ai/*` registry packages keep old versions under `latest`; this plugin declares `^0.1.0-rc.5` peer ranges so it resolves against the profile closure that dsh-base provides, and pins `0.1.0-rc.6` for development. Never install by bare `npm i @deepseek-ai/dsh-tools`.
- **CI / GitHub Action** (`dsh-github-action`, headless review→comment loop in the spirit of claude-code-action / codex-action) is a planned v2 companion repository; headless mode works because `never` approval policy fails closed, so an action must compose an answerer before posting.

## Development

```sh
pnpm install
pnpm test          # vitest: config, credentials, 429/retry, tools, commands, jobs, approval gate, token non-leakage
pnpm typecheck
pnpm build         # tsc → lib/ (noEmitOnError)
pnpm pack          # installable tarball
```

Tests mock the GitHub API, the `gh` CLI, and git through injected runners — no network, no real credentials. `test/security.test.ts` asserts the token string never appears in any model- or human-visible output.

## Layout

```
src/index.ts          plugin entry (name/inject/apply, applyWithDeps for tests)
src/config.ts         Schemastery Config
src/types.ts          local structural views of host services + Context merging
src/credential.ts     token resolution (seam → env → gh), per operation
src/github.ts         REST client: 429 retry, rate limits, diff media type
src/git.ts            read-only git inspection
src/review.ts         deterministic diff analyzer + comment drafting
src/jobs.ts           github-review background job producer
src/approval-gate.ts  tools/pre-execute ask/deny gate
src/tools.ts          the five model-facing tools
src/commands.ts       /pr, /review, /issue
src/present.ts        pure UI-card presenters
test/                 vitest suite + mock host scaffolding
cordis.patch.yml      bundle patch (one insert row)
scripts/prepare.mjs   self-contained git-install build
```

## License

[Apache License 2.0](LICENSE)
