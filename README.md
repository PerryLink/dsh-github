<h1 align="center">dsh-github</h1>

<p align="center">
  <b>Bring GitHub into DeepSeek Harness.</b><br/>
  Create pull requests · review PRs with inline or summary comments · manage issues · search — every write gated by human approval, token never logged.
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
  <img src="https://github.com/PerryLink/dsh-github/actions/workflows/ci.yml/badge.svg" alt="CI">
  <img src="https://img.shields.io/badge/documents-EN%2FZH%2FES%2FPT%2FHI-8257D0" alt="Documents: EN/ZH/ES/PT/HI">
</p>

---

**dsh-github** is a bundle plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) — the "everything is a plugin" agent harness. It fills the GitHub gap between dsh and tools like [Claude Code](https://github.com/anthropics/claude-code) (`gh claude` / [claude-code-action](https://github.com/anthropics/claude-code-action)) and [Codex](https://github.com/openai/codex) (`@codex review` / Autofix CI): your agent can **read a PR, review a PR, open a PR, merge and update PRs, read repo metadata and files, comment on and close issues, and search** — while a human approves every write and the token stays secret.

- 🛠 **12 tools** — `pr_create` · `pr_merge` · `pr_update` · `gh_review` · `review_post` · `gh_issue` · `issue_open` · `issue_comment` · `issue_close` · `gh_search` · `gh_repo` · `gh_file`, all canonical-JSON via `defineTool`
- ⌨️ **3 command families** — `/pr create` · `/review` (start/stop/post) · `/issue open`
- 🔀 **Full PR lifecycle** — create → review → update (title/body/state/base) → merge (merge/squash/rebase, optional head-branch delete)
- 📝 **Inline reviews** — `review_post` posts either one summary comment or line-anchored review comments against the PR head commit
- 🔒 **Approval-gated writes** — every GitHub write goes through `ctx.approval` (default `ask`, fail-closed); approval reasons preview titles, body sizes, and comment overrides
- 🗝 **Token secrecy** — credentials seam → environment → `gh` CLI, resolved per operation, never in logs, events, renders, or errors
- 🖥 **Background review jobs** — `/review` runs on `ctx.jobs` with the host's own `job_list` / `job_output` / `job_kill` surface, and reports CI status and comment counts alongside the findings
- 🤖 **Model review option** — `reviewMode: "model"` delegates the capped diff to a one-shot subagent through the host's `subagents` seam; the default `static` mode stays deterministic and token-free
- 🚦 **429 backoff + quota surfacing** — the model sees the remaining rate limit on every result, including failures; per-section fetch errors are surfaced instead of swallowed
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
- [PerryLink DSH Plugin Family](#perrylink-dsh-plugin-family)

## 🚀 Quick start

```sh
# 1. install (npm registry — simplest; or use the tarball channel below)
dsh plugin --profile <name> add @perrylink/dsh-github
#    tarball channel (no registry needed):
#    pnpm pack → dsh-github-<version>.tgz
#    dsh plugin --profile <name> add ./dsh-github-<version>.tgz

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
| **Update PRs** | `pr_update` edits title, body, state, or target branch — approval-gated like every other write |
| **Merge PRs** | `pr_merge` merges with `merge`/`squash`/`rebase`, optional commit title/message and head-branch deletion after the merge |
| **Review PRs** | `gh_review` summarizes metadata, capped diff (full text in the canonical value, bounded excerpt in the render), comments, CI status, and static findings — per-section fetch failures are reported as `diff.error` / `comments.error` / `ci.error` |
| **Post reviews** | `review_post` publishes one aggregated issue-level comment (`mode: "summary"`, default) or line-anchored review comments on the PR head commit (`mode: "inline"`); a `body` override lets the model polish the comment first — after human approval |
| **Background reviews** | `/review <pr>` fetches metadata, the capped diff, CI checks, and existing comments in a `ctx.jobs` job; the completion output carries the findings summary, CI status, and comment count. `reviewMode: "model"` delegates the diff to a one-shot subagent instead of the static analyzer |
| **Read repos** | `gh_repo` reads repository metadata: description, default branch, visibility, stars, forks, open issues, language, license, topics |
| **Read files** | `gh_file` reads one file at a branch/tag/commit with base64 decoding and a configurable cap; directories report a structured error |
| **Read issues** | `gh_issue` lists / gets / comments; pull requests in listings are marked `kind: "pr"` |
| **Manage issues** | `issue_open` creates, `issue_comment` comments (also works on PRs), `issue_close` closes with an optional state reason — all approval-gated |
| **Search** | `gh_search` queries issues and pull requests with GitHub search syntax, surfacing the separate search quota |
| **Approval** | `tools/pre-execute` asks `ctx.approval` for every write; `allowedActions` whitelist denies before prompting |
| **Secret safety** | Token is read per operation and sent only in the Authorization header; a dedicated test asserts it never appears in any visible output |
| **Resilience** | 429 retry with `Retry-After`/`x-ratelimit-reset` backoff; read tools are concurrency-safe; all calls honor cancellation |
| **Observability** | Model-visible ⇔ logged: everything the model sees flows through the host's own session events (`tool/result`, `user/message`, `command/run`, `approval/asked`…) |

## 📦 Installation

Four documented channels — pick one.

| Channel | Command | Notes |
|---|---|---|
| **npm registry** | `dsh plugin --profile <name> add @perrylink/dsh-github` | Published package — the simplest channel |
| **npm tarball** | `dsh plugin --profile <name> add ./dsh-github-<version>.tgz` | Ships with `lib/` built — no build permission |
| **git source** | `dsh plugin --profile <name> add "github:PerryLink/dsh-github#<sha>"` | Needs `prepare` + `allowBuilds` (see below); pin the commit |
| **local link** | `pnpm link --dir .` then `dsh plugin add @perrylink/dsh-github` | Development |

> The npm package is published under the `@perrylink` scope because the
> unscoped `dsh-github` name is owned by an unrelated project on the registry.
> The plugin's module name stays `dsh-github`.

Git installs: pnpm ≥10 refuses a git dependency's `prepare` until allowlisted — `dsh` prints the exact key; copy it into the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  '@perrylink/dsh-github': true
```

The `prepare` script (`scripts/prepare.mjs`) is self-contained: it builds with TypeScript when a compiler is resolvable, otherwise falls back to the **committed `lib/` artifacts**, and fails loud with neither.

**Uninstall:** `dsh plugin --profile <name> remove @perrylink/dsh-github`.

## ⚙️ Configuration

Schemastery-validated at load time (fail loud). Override any key in the profile's `cordis.patch.yml` (the whole row config is replaced, never deep-merged).

| Key | Default | Meaning |
|---|---|---|
| `tokenSource` | `auto` | `auto` (credentials → env → gh) or one of `credentials` / `env` / `gh` |
| `tokenRef` | `GITHUB_TOKEN` | Credential-seam reference / environment-variable name |
| `defaultOwnerRepo` | — | Fallback `owner/repo` when a call names none and git has no origin |
| `autoCommit` | `false` | Whether `/pr create` may instruct the model to commit+push first |
| `maxDiffChars` | `8000` | Character cap for PR diffs read into reviews |
| `renderExcerptChars` | `2000` | Character cap for the diff excerpt rendered into tool output |
| `maxComments` | `20` | Cap for PR comments listed by `gh_review` |
| `reviewJobTimeoutMs` | `600000` | Deadline for one background review job (fails with `timeout`) |
| `maxReviewRecords` | `50` | Cap for in-memory review-job records; oldest settled records evict first |
| `maxFileChars` | `12000` | Character cap for file contents read by `gh_file` |
| `maxFindings` | `50` | Cap for analyzer findings per review |
| `maxLineLength` | `300` | Line length beyond which the analyzer flags a long-line finding |
| `reviewMode` | `static` | Review engine: `static` (deterministic analyzer) or `model` (one-shot subagent through the host's `subagents` seam; fails loud when the seam is absent) |
| `modelReviewProvider` | — | Subagent provider name for `reviewMode: "model"`; defaults to the first registered provider |
| `maxRetries` | `3` | 429 retry attempts per request |
| `retryBaseMs` | `500` | Retry backoff base (doubles per attempt) |
| `retryMaxWaitMs` | `60000` | Retry backoff ceiling |
| `requestTimeoutMs` | `30000` | Hard per-request timeout; aborts the fetch when exceeded |
| `apiBaseUrl` | `https://api.github.com` | GitHub REST base URL (GitHub Enterprise) |
| `allowedActions` | `['pr.create','pr.merge','pr.update','review.post','issue.create','issue.comment','issue.close','ci.run']` | Write-action whitelist; anything else is denied before approval |
| `workspaceDir` | process cwd | Working directory for read-only git inspection |
| `ci` | `{ enabled: false, … }` | CI integration section: polling review bot, status-check gate, and the one-shot `ci_run` tool (all `ci.*` keys live inside it) |

## 🛠 Tools

| Tool | Kind | Parameters | Returns |
|---|---|---|---|
| `pr_create` | write | `title*`, `body?`, `base?`, `head?`, `draft?`, `ownerRepo?` | `{status:'created', url, number, title, state, draft, base, head, rateLimit}` or structured error |
| `pr_merge` | write | `pr*` (number / `#n` / `o/r#n` / URL), `mergeMethod?`, `commitTitle?`, `commitMessage?`, `deleteBranch?` | `{status:'merged', merged, sha?, message, url, branchDeleted, branchDeleteNote?, rateLimit}` or structured error |
| `pr_update` | write | `pr*` (number / `#n` / `o/r#n` / URL), `title?`, `body?`, `state?` (`open`/`closed`), `base?` | `{status:'updated', url, number, title, state, base, rateLimit}` or structured error |
| `gh_review` | read | `pr*` (number / `#n` / `o/r#n` / URL), `fields?`, `maxDiffChars?` | metadata, capped diff (full `diff.text` + bounded `diff.excerpt` + per-file stats), comments, CI, static findings, per-section `error` fields, rate limit |
| `gh_repo` | read | `ownerRepo?` | `{repo, description, defaultBranch, visibility, stars, forks, openIssues, language, license, topics, url, updatedAt, rateLimit}` or structured error |
| `gh_file` | read | `ownerRepo?`, `path*`, `ref?`, `maxChars?` | `{repo, path, ref, size, truncated, content, sha, url, rateLimit}` or structured error |
| `gh_issue` | read | `action*` (`list`/`get`/`comments`), `ownerRepo?`, `issueNumber?`, `state?`, `limit?` | normalized items (each marked `kind: issue/pr/comment`) + rate limit |
| `review_post` | write | `jobId*`, `mode?` (`summary`/`inline`), `body?` | `{status:'posted', mode, url, commentId?, reviewId?, findings, rateLimit}` or structured error |
| `issue_open` | write | `title*`, `body?`, `labels?`, `ownerRepo?` | `{status:'created', url, number, title, rateLimit}` or structured error |
| `issue_comment` | write | `issueNumber*`, `body*`, `ownerRepo?` | `{status:'commented', url, commentId, issueNumber, rateLimit}` or structured error |
| `issue_close` | write | `issueNumber*`, `ownerRepo?`, `stateReason?` (`completed`/`not_planned`) | `{status:'closed', url, number, title, rateLimit}` or structured error |
| `gh_search` | read | `q*`, `sort?`, `order?`, `perPage?` | `{query, total, items[{number,title,state,kind,author,url,repo,comments,createdAt}], rateLimit}` or structured error |

`execute` returns only the canonical JSON declared by `output.schema`. Missing-token and GitHub-API failures are structured error variants carrying rate-limit facts; infrastructure failures throw (→ `isError`). `exec.signal` is honored everywhere.

## ⌨️ Commands

| Command | Effect |
|---|---|
| `/pr create [title]` | Reads git state and queues a `pr_create` instruction for the model (draft body, defaults, no commit/push unless `autoCommit`). Creating the PR asks for approval. |
| `/review <pr>` | Starts a background review job; prints the job id. Completion is announced by the host; read it with `job_output`. |
| `/review <pr> --max-diff <n> --no-ci --no-comments` | Per-job overrides: diff cap and which supplementary sections the job fetches. |
| `/review stop <jobId>` | Cancels the job (local control, no GitHub write). |
| `/review post <jobId>` | Queues a `review_post` instruction for the model (summary or inline); posting asks for approval. |
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
 model ─── pr_create / pr_merge / pr_update / gh_review /           │
           review_post / gh_issue / issue_open / issue_comment /    │
           issue_close / gh_search / gh_repo / gh_file              │
           (defineTool, canonical JSON only)                        │
                    │                                               │
                    └───────┬───────────────┬───────────────┬───────┘
                            │               │               │
                  tools/pre-execute     credential        GitHub REST
                  approval gate        resolution        client (fetch,
                  (ask | deny)      (seam → env →       429 retry,
                                    gh CLI, per-op)     rate-limit)
```

- **Credential seam.** `tokenSource: auto` resolves per operation in the order credentials seam (`GITHUB_TOKEN` reference) → environment variable → `gh` CLI token. The value is a local variable handed to the REST client; it never enters canonical values, renders, cards, command outputs, injected notices, job output, approval reasons, or error messages.
- **Approval.** All writes flow through model tools. A `tools/pre-execute` waterfall listener returns `ask` for the seven write tools, so the registry asks the human through `ctx.approval` (the host logs the `approval/asked` + `approval/decided` audit pair) and fails closed without an answerer. Approval reasons preview what would be published (titles, body sizes, merge methods, and the first line of an overridden review body). Commands never write directly: command handlers run with no open turn, so the approval seam is structurally closed to them — a write command gathers read-only context, then wakes the agent (`followup` when idle, `inject` when busy) so the model runs the gated tool inside a turn.
- **Background review.** `/review <pr>` starts a `github-review` job on `ctx.jobs` (label, owner, timeout, cancelable). The job resolves the token per operation, fetches the PR metadata (capturing the head-commit SHA for inline posting), the capped diff, and — unless disabled — CI check runs and existing review comments, then runs a deterministic multi-file analyzer (`src/review.ts`: hardcoded secrets, Google API keys, credential assignments, debug artifacts, eval, TODO markers, long lines, oversized changes) — zero tokens spent, fully testable. With `reviewMode: "model"`, the job instead hands the capped diff to a one-shot subagent through the host's `subagents` seam (the owning agent is the parent) and stores the child's Markdown output as the postable report; a missing seam or provider fails loud. Supplementary fetch failures are noted in the output without failing the job. Completion notices reach the initiating session through the host's `dsh-tool-jobs` consumer; the model reads the report via the existing `job_output` tool and publishes it with `review_post` — approval required.
- **Model-visible ⇔ logged.** The plugin appends **no custom session event types**. Out-of-repo event types are not in the host's `KNOWN_SESSION_EVENT_TYPES`, so an unknown required event would make the session log unreadable after plugin removal (the host deliberately defers a registration surface for external plugins). All model-visible content therefore flows through host-logged surfaces: `tool/result` canonical values, `user/message` notices via `agent.inject`/`agent.followup`, the `command/run` + `command/done` lifecycle pair, and the `approval/asked` + `approval/decided` audit pair.
- **Pure presenters.** `presentCall`/`presentResult` are pure functions of `args` (+ the persisted `result.meta`), identical on live streaming and log replay. PR creation shows a generic card with the PR URL.

## 🔒 Security boundaries

- The token is read per operation from the configured source (credentials seam, environment, or `gh` CLI) and sent only in the REST client's Authorization header. It is never logged, never rendered, never injected, never appended to the session log, and never appears in error messages.
- Every GitHub write requires `allowed-once` from `ctx.approval` (default policy `ask`); `rejected`, `cancelled`, and `unavailable` all fail closed.
- `/pr create` never commits or pushes by itself; with `autoCommit: true` the model performs those writes through the bash tool's own approval gate. dsh-github does **not** manage git identity (dsh-git-identity's job) or worktrees (dsh-worktree's job).
- The review job performs no writes: it reads a diff and stores a report in process memory; only `review_post` publishes, after approval.
- Posted comments interpolate diff-derived file names, which are untrusted repository content: `formatPostBody` backtick-escapes and HTML-escapes file names so a hostile PR cannot inject Markdown into the review comment.
- File contents read by `gh_file` and issue/PR bodies, comments, and search results read from GitHub are external untrusted content that enters model context — the same inherent tradeoff as web fetching; the plugin marks them as external content in its renders.
- Rate limits: 429s are retried with backoff and the remaining quota is surfaced to the model on every result, including failures.

## ⚠️ Known limitations

- **No custom session events** — deliberate (see Architecture); audit trails rely on the host's own event vocabulary.
- **Static analyzer by default** — deterministic rules (`src/review.ts`), zero tokens, reproducible. `reviewMode: "model"` delegates the capped diff to a one-shot subagent through the host's `subagents` seam for an LLM review (costs tokens; requires the seam and a registered provider).
- **Jobs and records are process-local** — the review report lives in plugin memory keyed by job id, matching the host job registry's lifetime; the record map is capped by `maxReviewRecords` (oldest settled records evict first).
- **npm `latest` dist-tags are stale** — the plugin declares `^0.1.0-rc.5` peer ranges so it resolves against the profile closure that `dsh-base` provides, and pins `0.1.0-rc.6` for development. Never install by bare `npm i @deepseek-ai/dsh-tools`.
- **CI / GitHub Action** — ships in this repository (v0.6.0): a composite action (`action.yml`) that reviews PRs, fixes CI, and writes the report; a polling review bot with idempotent inline comments; and a status-check gate. Every write stays approval-gated.

## 🧪 Development

```sh
pnpm install
pnpm test          # vitest: config, credentials, 429/retry, tools, commands, jobs, approval gate, token non-leakage
pnpm typecheck
pnpm build         # tsc → lib/ (noEmitOnError)
pnpm pack          # installable tarball
pnpm run check:readmes   # cross-checks TOC anchors, tools, and config keys in all 5 READMEs
```

Tests mock the GitHub API, the `gh` CLI, and git through injected runners — no network, no real credentials. `test/security.test.ts` asserts the token string never appears in any model- or human-visible output. `test/e2e.test.ts` contains opt-in real-API smoke tests that self-skip unless `DSH_GITHUB_E2E_TOKEN` is set (read-only endpoints only; the dedicated variable keeps the unit suite hermetic).

## 🗂 Repository layout

```
src/index.ts          plugin entry (name/inject/apply, applyWithDeps for tests)
src/config.ts         Schemastery Config
src/types.ts          local structural views of host services + Context merging
src/credential.ts     token resolution (seam → env → gh), per operation
src/github.ts         REST client: 429 retry, rate limits, diff media type
src/git.ts            read-only git inspection + origin parsing for any API host
src/review.ts         deterministic diff analyzer + sanitized comment drafting
src/jobs.ts           github-review background job producer (metadata + diff + CI + comments)
src/approval-gate.ts  tools/pre-execute ask/deny gate with write previews
src/tools.ts          the twelve model-facing tools
src/commands.ts       /pr, /review, /issue
src/present.ts        pure UI-card presenters
test/                 vitest suite + mock host scaffolding + opt-in e2e smoke
cordis.patch.yml      bundle patch (one insert row)
scripts/prepare.mjs   self-contained git-install build
```

## 🏷 Topics

Recommended GitHub repository topics (set them in the repo settings — they power the [`dsh-plugin` topic page](https://github.com/topics/dsh-plugin) and the DSH plugin marketplaces):

`dsh` · `dsh-plugin` · `deepseek-harness` · `github` · `pull-request` · `code-review` · `issue-tracker`

## License

[Apache License 2.0](LICENSE)

## PerryLink DSH Plugin Family

This project is one of the [15 DeepSeek Harness plugins](https://github.com/PerryLink) maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| [dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel) | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors |
| [dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck) | Engineering-discipline guard: requirements grill, test gates, adversary review |
| [dsh-background-agents](https://github.com/PerryLink/dsh-background-agents) | Durable background child agents with a Web UI sidebar, messaging and interrupt |
| [dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions) | LSP diagnostics, formatting, completion, code actions and rename over language servers |
| [dsh-output-styles](https://github.com/PerryLink/dsh-output-styles) | Claude Code outputStyles-equivalent runtime style switching |
| [dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind) | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |
| [dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules) | Claude Code-style declarative allow/deny/ask permission rules with audit |
| [dsh-auto-review](https://github.com/PerryLink/dsh-auto-review) | Second-model auto-review on the approval chain, fail-closed by default |
| [dsh-memento](https://github.com/PerryLink/dsh-memento) | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool |
| [dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security) | Security-audit skill pack: secret scan, dependency and supply-chain review |
| [dsh-session-pin](https://github.com/PerryLink/dsh-session-pin) | Pin sessions in the Web sidebar with durable ordering |
| [dsh-composer-history](https://github.com/PerryLink/dsh-composer-history) | Terminal-style input history for the web composer: arrows, Ctrl+R search |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval |
| [dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide) | Plugin-development knowledge base as an on-demand agent skill |
| [dsh-claude-move](https://github.com/PerryLink/dsh-claude-move) | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH |
