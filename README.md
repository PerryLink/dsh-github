<h1 align="center">dsh-github</h1>

<p align="center">
  <b>Bring GitHub into DeepSeek Harness.</b><br/>
  Create pull requests · review PRs in background jobs · read issues — every write gated by human approval, token never leaves the credential layer.
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.hi.md">हिन्दी</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License: Apache 2.0">
  <img src="https://img.shields.io/badge/dsh-0.1.0--rc.6-4D6BFE" alt="dsh: 0.1.0-rc.6">
  <img src="https://img.shields.io/badge/dsh-dsh--plugin-4D6BFE" alt="dsh-plugin">
  <img src="https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen" alt="Node: ^22.19 || >=24">
  <img src="https://img.shields.io/badge/tests-77%20passed-brightgreen" alt="Tests: 77 passed">
  <img src="https://img.shields.io/badge/documents-EN%2FZH%2FES%2FPT%2FHI-8257D0" alt="Documents: EN/ZH/ES/PT/HI">
</p>

---

**dsh-github** is a bundle plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) — the "everything is a plugin" agent harness. It fills the GitHub gap between dsh and tools like [Claude Code](https://github.com/anthropics/claude-code) (`gh claude` / [claude-code-action](https://github.com/anthropics/claude-code-action)) and [Codex](https://github.com/openai/codex) (`@codex review` / Autofix CI): your agent can **read a PR, review a PR, and open a PR** — while a human approves every write and the token stays secret.

- 🛠 **5 tools** — `pr_create` · `gh_review` · `gh_issue` · `review_post` · `issue_open`, all canonical-JSON via `defineTool`
- ⌨️ **3 command families** — `/pr create` · `/review` (start/stop/post) · `/issue open`
- 🔒 **Approval-gated writes** — every GitHub write goes through `ctx.approval` (default `ask`, fail-closed)
- 🗝 **Token secrecy** — credentials seam → environment → `gh` CLI, resolved per operation, never in logs, events, renders, or errors
- ⏱ **Background review jobs** — `/review` runs on `ctx.jobs` with the host's own `job_list` / `job_output` / `job_kill` surface
- 🚦 **429 backoff + quota surfacing** — the model sees the remaining rate limit on every read
- 🌐 **5-language docs** — English · 中文 · Español · Português · हिन्दी

---

## 📚 Table of contents

- [Quick start](#🚀-quick-start)
- [Features](#✨-features)
- [Installation](#📦-installation)
- [Configuration](#⚙️-configuration)
- [Tools](#🛠-tools)
- [Commands](#⌨️-commands)
- [Architecture](#🏗-architecture)
- [Security boundaries](#🔒-security-boundaries)
- [Known limitations](#⚠️-known-limitations)
- [Development](#🧪-development)
- [Repository layout](#🗂-repository-layout)
- [Topics](#🏷-topics)
- [License](#license)

## 🚀 Quick start

```sh
# 1. install (tarball channel — no build permission needed)
pnpm pack                              # inside this repo → dsh-github-0.1.0.tgz
dsh plugin --profile <name> add ./dsh-github-0.1.0.tgz

# 2. configure a GitHub token (recommended: the credentials seam)
#    $DSH_HOME/.credentials.yaml
#    GITHUB_TOKEN: <your token>

# 3. use it — in the dsh web UI or headless
#    /pr create "add dark mode"      → agent drafts & opens the PR (approval required)
#    /review 42                      → background review job, read it with job_output
#    /review post github-review-1    → publish the review comment (approval required)
#    /issue open "crash on startup"  → agent opens the issue (approval required)
```

Verify: `dsh --profile <name> --dump-config` must show the `# == dsh-github` section with **no FAILED lines**.

## ✨ Features

| Area | What you get |
|---|---|
| **Create PRs** | `/pr create [title]` reads git state (branch, changed files, commits ahead) and hands the agent a draft; `pr_create` opens the PR and returns its URL |
| **Review PRs** | `gh_review` summarizes metadata, capped diff, comments, CI status, and static findings; `/review` runs a full background job |
| **Post reviews** | `/review post <jobId>` publishes the job's drafted comment — after human approval |
| **Read issues** | `gh_issue` lists / gets / comments; `issue_open` creates (approval-gated) |
| **Approval** | `tools/pre-execute` asks `ctx.approval` for every write; `allowedActions` whitelist denies before prompting |
| **Secret safety** | Token lives only in the credential layer + Authorization header; a dedicated test asserts it never appears in any visible output |
| **Resilience** | 429 retry with `Retry-After`/`x-ratelimit-reset` backoff; read tools are concurrency-safe; all calls honor cancellation |
| **Observability** | Model-visible ⇔ logged: everything the model sees flows through the host's own session events (`tool/result`, `user/message`, `command/run`, `approval/asked`…) |

## 📦 Installation

Three documented channels — pick one.

| Channel | Command | Notes |
|---|---|---|
| **npm tarball** | `dsh plugin --profile <name> add ./dsh-github-0.1.0.tgz` | Ships with `lib/` built — no build permission |
| **git source** | `dsh plugin --profile <name> add "github:PerryLink/dsh-github#<sha>"` | Needs `prepare` + `allowBuilds` (see below); pin the commit |
| **local link** | `pnpm link --dir .` then `dsh plugin add dsh-github` | Development |

Git installs: pnpm ≥10 refuses a git dependency's `prepare` until allowlisted — `dsh` prints the exact key; copy it into the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-github: true
```

The `prepare` script (`scripts/prepare.mjs`) is self-contained: it builds with TypeScript when a compiler is resolvable, otherwise falls back to the **committed `lib/` artifacts**, and fails loud with neither.

**Uninstall:** `dsh plugin --profile <name> remove dsh-github`.

## ⚙️ Configuration

Schemastery-validated at load time (fail loud). Override any key in the profile's `cordis.patch.yml` (the whole row config is replaced, never deep-merged).

| Key | Default | Meaning |
|---|---|---|
| `tokenSource` | `auto` | `auto` (credentials → env → gh) or one of `credentials` / `env` / `gh` |
| `tokenRef` | `GITHUB_TOKEN` | Credential-seam reference / environment-variable name |
| `defaultOwnerRepo` | — | Fallback `owner/repo` when a call names none and git has no origin |
| `autoCommit` | `false` | Whether `/pr create` may instruct the model to commit+push first |
| `maxDiffChars` | `8000` | Cap for PR diffs read into reviews |
| `maxComments` | `20` | Cap for PR comments listed by `gh_review` |
| `reviewJobTimeoutMs` | `600000` | Deadline for one background review job (fails with `timeout`) |
| `maxRetries` | `3` | 429 retry attempts per request |
| `retryBaseMs` | `500` | Retry backoff base (doubles per attempt) |
| `retryMaxWaitMs` | `60000` | Retry backoff ceiling |
| `apiBaseUrl` | `https://api.github.com` | GitHub REST base URL (GitHub Enterprise) |
| `allowedActions` | `['pr.create','review.post','issue.create']` | Write-action whitelist; anything else is denied before approval |
| `workspaceDir` | process cwd | Working directory for read-only git inspection |

## 🛠 Tools

| Tool | Kind | Parameters | Returns |
|---|---|---|---|
| `pr_create` | write | `title*`, `body?`, `base?`, `head?`, `draft?`, `ownerRepo?` | `{status:'created', url, number, title, state, draft, base, head}` or structured error |
| `gh_review` | read | `pr*` (number / `#n` / `o/r#n` / URL), `fields?`, `maxDiffChars?` | metadata, capped diff + excerpt + per-file stats, comments, CI, static findings, rate limit |
| `gh_issue` | read | `action*` (`list`/`get`/`comments`), `ownerRepo?`, `issueNumber?`, `state?`, `limit?` | normalized issue items + rate limit |
| `review_post` | write | `jobId*` | `{status:'posted', url, commentId, findings}` or structured error |
| `issue_open` | write | `title*`, `body?`, `labels?`, `ownerRepo?` | `{status:'created', url, number, title}` or structured error |

`execute` returns only the canonical JSON declared by `output.schema`. Missing-token and GitHub-API failures are structured error variants; infrastructure failures throw (→ `isError`). `exec.signal` is honored everywhere.

## ⌨️ Commands

| Command | Effect |
|---|---|
| `/pr create [title]` | Reads git state and queues a `pr_create` instruction for the model (draft body, defaults, no commit/push unless `autoCommit`). Creating the PR asks for approval. |
| `/review <pr>` | Starts a background review job; prints the job id. Completion is announced by the host; read it with `job_output`. |
| `/review stop <jobId>` | Cancels the job (local control, no GitHub write). |
| `/review post <jobId>` | Queues a `review_post` instruction for the model; posting asks for approval. |
| `/issue open <title>` | Queues an `issue_open` instruction for the model; creating asks for approval. |

## 🏗 Architecture

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

- **Credential seam.** `tokenSource: auto` resolves per operation in the order credentials seam (`GITHUB_TOKEN` reference) → environment variable → `gh` CLI token. The value is a local variable handed to the REST client; it never enters canonical values, renders, cards, command outputs, injected notices, job output, approval reasons, or error messages.
- **Approval.** All writes flow through model tools. A `tools/pre-execute` waterfall listener returns `ask` for `pr_create` / `review_post` / `issue_open`, so the registry asks the human through `ctx.approval` (the host logs the `approval/asked` + `approval/decided` audit pair) and fails closed without an answerer. Commands never write directly: command handlers run with no open turn, so the approval seam is structurally closed to them — a write command gathers read-only context, then wakes the agent (`followup` when idle, `inject` when busy) so the model runs the gated tool inside a turn.
- **Background review.** `/review <pr>` starts a `github-review` job on `ctx.jobs` (label, owner, timeout, cancelable). The job resolves the token per operation, fetches the capped diff, and runs a deterministic multi-file analyzer (`src/review.ts`: hardcoded secrets, debug artifacts, eval, TODO markers, long lines, oversized changes) — zero tokens spent, fully testable. Completion notices reach the initiating session through the host's `dsh-tool-jobs` consumer; the model reads the report via the existing `job_output` tool and publishes it with `review_post` — approval required.
- **Model-visible ⇔ logged.** The plugin appends **no custom session event types**. Out-of-repo event types are not in the host's `KNOWN_SESSION_EVENT_TYPES`, so an unknown required event would make the session log unreadable after plugin removal (the host deliberately defers a registration surface for external plugins). All model-visible content therefore flows through host-logged surfaces: `tool/result` canonical values, `user/message` notices via `agent.inject`/`agent.followup`, the `command/run` + `command/done` lifecycle pair, and the `approval/asked` + `approval/decided` audit pair.
- **Pure presenters.** `presentCall`/`presentResult` are pure functions of `args` (+ the persisted `result.meta`), identical on live streaming and log replay. PR creation shows a generic card with the PR URL.

## 🔒 Security boundaries

- The token exists only inside the credential resolution result and the REST client's Authorization header. It is never logged, never rendered, never injected, never appended to the session log.
- Every GitHub write requires `allowed-once` from `ctx.approval` (default policy `ask`); `rejected`, `cancelled`, and `unavailable` all fail closed.
- `/pr create` never commits or pushes by itself; with `autoCommit: true` the model performs those writes through the bash tool's own approval gate. dsh-github does **not** manage git identity (dsh-git-identity's job) or worktrees (dsh-worktree's job).
- The review job performs no writes: it reads a diff and stores a report in process memory; only `review_post` publishes, after approval.
- Rate limits: 429s are retried with backoff and the remaining quota is surfaced to the model.

## ⚠️ Known limitations

- **No custom session events** — deliberate (see Architecture); audit trails rely on the host's own event vocabulary.
- **Static analyzer, not a model reviewer** — deterministic rules (`src/review.ts`), zero tokens, reproducible; a model-based review pass through the subagent seam is a documented v2 extension point.
- **One aggregated comment** — `review_post` publishes a single PR issue-level comment rather than inline per-line review comments (v2).
- **Jobs and records are process-local** — the review report lives in plugin memory keyed by job id, matching the host job registry's lifetime.
- **npm `latest` dist-tags are stale** — the plugin declares `^0.1.0-rc.5` peer ranges so it resolves against the profile closure that `dsh-base` provides, and pins `0.1.0-rc.6` for development. Never install by bare `npm i @deepseek-ai/dsh-tools`.
- **CI / GitHub Action** (`dsh-github-action`, headless review→comment loop in the spirit of claude-code-action / codex-action) is a planned v2 companion repository.

## 🧪 Development

```sh
pnpm install
pnpm test          # vitest: config, credentials, 429/retry, tools, commands, jobs, approval gate, token non-leakage
pnpm typecheck
pnpm build         # tsc → lib/ (noEmitOnError)
pnpm pack          # installable tarball
```

Tests mock the GitHub API, the `gh` CLI, and git through injected runners — no network, no real credentials. `test/security.test.ts` asserts the token string never appears in any model- or human-visible output.

## 🗂 Repository layout

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

## 🏷 Topics

Recommended GitHub repository topics (set them in the repo settings — they power the [`dsh-plugin` topic page](https://github.com/topics/dsh-plugin) and the DSH plugin marketplaces):

`dsh` · `dsh-plugin` · `deepseek-harness` · `github` · `pull-request` · `code-review` · `issue-tracker`

## License

[Apache License 2.0](LICENSE)
