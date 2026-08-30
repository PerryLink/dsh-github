<div align="center">

# dsh-github
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-github)

**GitHub PRs, reviews, issues, and CI for DeepSeek Harness — every write gated by human approval, token never logged.**

*Create, review, merge, and search GitHub from the agent, with a CI composite action, polling review bot, and status-check gate.*

> **Official repository.** This is the only official repository of dsh-github, maintained by PerryLink. Same-name repositories under other accounts are not affiliated.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-github/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-github/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-github?label=version)](https://github.com/PerryLink/dsh-github/releases)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)
- **1024 store channel**: `npm i -g dsh1024` once, then `dsh1024 plugin --profile web add @perrylink/dsh-github` (counts toward the [deepseek1024.com](https://deepseek1024.com) install ranking).
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

</div>

---

## 📚 Table of contents

- [Compatibility](#compatibility)
- [What you get](#what-you-get)
- [Quick start](#quick-start)
- [Install & uninstall](#install-&-uninstall)
- [Configuration](#configuration)
- [Tools & surfaces](#tools-&-surfaces)
- [Architecture](#architecture)
- [Permissions & data](#permissions-&-data)
- [Security boundaries](#security-boundaries)
- [Known limitations](#known-limitations)
- [Development](#development)
- [Repository layout](#repository-layout)
- [Topics](#topics)
- [Contributors](#contributors)
- [PerryLink DSH Plugin Family](#perrylink-dsh-plugin-family)
- [License](#license)

## Compatibility

| Surface | Status |
|---|---|
| Harness | DeepSeek Harness `0.1.1-rc.2` (compat declared for `0.1.1-rc.2`) |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Platforms | All (host plugin; outbound network to GitHub) |
| Model | Any (static review is deterministic; `reviewMode: "model"` is optional) |

## What you get

`dsh-github` fills the GitHub gap between `dsh` and tools like Claude Code and Codex: your agent can read, review, open, update, and merge pull requests, read repository metadata and files, comment on and close issues, and search — while a human approves every write and the token stays secret.

- **14 tools** — `pr_create`, `pr_merge`, `pr_update`, `gh_review`, `review_post`, `gh_issue`, `issue_open`, `issue_comment`, `issue_close`, `gh_search`, `gh_repo`, `gh_file`, `gh_repo_search`, `gh_checks`, all canonical JSON via `defineTool`.
- **3 command families** — `/pr create`, `/review` (start/stop/post), `/issue open`.
- **Full PR lifecycle** — create → review → update (title/body/state/base) → merge (merge/squash/rebase, optional head-branch delete).
- **Inline reviews** — `review_post` posts one summary comment or line-anchored review comments against the PR head commit.
- **Approval-gated writes** — every GitHub write goes through `ctx.approval` (default `ask`, fail-closed); approval reasons preview titles, body sizes, and comment overrides.
- **Token secrecy** — credentials seam → environment → `gh` CLI, resolved per operation, never in logs, events, renders, or errors.
- **Background review jobs** — `/review` runs on `ctx.jobs` with the host's own `job_list` / `job_output` / `job_kill` surface.
- **Resilience** — 429 retry with `Retry-After`/`x-ratelimit-reset` backoff; read tools are concurrency-safe; all calls honor cancellation.
- **CI surface** — the one-shot `ci_run` tool, a polling review bot, and a status-check gate (composite action `action.yml`).

## Quick start

```sh
# 1. install the bundle into your profile
dsh plugin --profile web add "github:PerryLink/dsh-github#main"

# or from npm (published releases)
dsh plugin --profile web add @perrylink/dsh-github

# 2. restart and verify the row
dsh --profile web --dump-config | grep -A3 'id: dsh-github'
```

## Install & uninstall

- **git channel** (latest `main`): `dsh plugin --profile web add "github:PerryLink/dsh-github#main"` — the `prepare` script builds with production dependencies only.
- **npm channel** (published releases): `dsh plugin --profile web add @perrylink/dsh-github`.
- **tarball channel**: `pnpm pack` in this repo, then `dsh plugin --profile web add ./dsh-github-<version>.tgz`.
- **uninstall**: `dsh plugin --profile web remove dsh-github` (or remove the row from the profile patch).

## Configuration

All tunables are Schemastery `Config` fields (changeable from cordis.yml). An id-targeted override replaces the whole row — restate every key you need. `cordis.patch.yml` documents each key inline.

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

## Tools & surfaces

| Surface | Kind | Notes |
|---|---|---|
| `pr_create` | tool | Create a pull request (write; approval-gated) |
| `pr_merge` | tool | Merge a PR (merge/squash/rebase, optional head-branch delete) |
| `pr_update` | tool | Update a PR (title/body/state/base) |
| `gh_review` | tool | Read a PR: metadata, capped diff, comments, CI, static findings |
| `review_post` | tool | Publish a review comment (summary or line-anchored inline) |
| `gh_issue` | tool | List / get / comment on issues (PRs marked `kind: "pr"`) |
| `issue_open` | tool | Create an issue |
| `issue_comment` | tool | Comment on an issue or PR |
| `issue_close` | tool | Close an issue (optional state reason) |
| `gh_search` | tool | Search issues and PRs (separate search quota) |
| `gh_repo` | tool | Read repository metadata |
| `gh_file` | tool | Read one file at a branch/tag/commit |
| `gh_repo_search` | tool | GraphQL repository search (separate search quota) |
| `gh_checks` | tool | GraphQL PR status checks (check runs + commit statuses) |
| `/pr create` | command | Read git state and queue a `pr_create` instruction |
| `/review` | command | Start / stop / post a background review job |
| `/issue open` | command | Queue an `issue_open` instruction |
| `ci_run` | tool | One-shot CI review run by the composite action / CI driver |
| review bot | surface | Polling review bot with idempotent inline comments (`ci.*`) |
| status-check gate | surface | Publishes the `success` / `needs-changes` verdict per PR head commit (`action.yml`) |

## Architecture

- **Credential seam.** `tokenSource: auto` resolves per operation in the order credentials seam (`GITHUB_TOKEN` reference) → environment variable → `gh` CLI token. The value is a local variable handed to the REST client; it never enters canonical values, renders, cards, command outputs, injected notices, job output, approval reasons, or error messages.
- **Approval gate.** All writes flow through model tools. A `tools/pre-execute` waterfall listener returns `ask` for the write tools, so the registry asks the human through `ctx.approval` (the host logs the `approval/asked` + `approval/decided` audit pair) and fails closed without an answerer. Commands never write directly: a write command gathers read-only context, then wakes the agent so the model runs the gated tool inside a turn.
- **Background review job.** `/review <pr>` starts a `github-review` job on `ctx.jobs`; the job fetches metadata (capturing the head-commit SHA for inline posting), the capped diff, CI checks, and existing comments, then runs the deterministic multi-file analyzer (`src/review.ts`). With `reviewMode: "model"`, the job hands the capped diff to a one-shot subagent through the host's `subagents` seam. Completion reaches the session through the host's `dsh-tool-jobs` consumer; the model reads it with `job_output` and publishes it with `review_post`.
- **CI composite action / review bot / status-check gate.** The repo ships a composite action (`action.yml`) that reviews PRs, fixes CI, and writes the report; a polling review bot posts idempotent inline comments; and a status-check gate publishes the verdict per PR head commit. The one-shot `ci_run` tool drives the headless run. Every write stays approval-gated.

## Permissions & data

- **Permissions**: writes ride the official approval seam; nothing is re-implemented or bypassed. The plugin declares `network:outbound` and `filesystem:write` in its workshop manifest.
- **Data**: the review report lives in process memory keyed by job id; nothing durable is written to disk.
- **Session log**: the plugin adds no custom session event types; all model-visible content flows through host-logged surfaces (`tool/result`, `user/message`, `command/run`, `approval/asked`…).

## Security boundaries

- **Approval, not enforcement.** Writes only produce `ask`/deny decisions on the official seam; the sandbox and approval systems remain the enforcement authorities.
- **Fail closed.** Missing approval answerer degrades to the strictest decision — never to silent pass-through.
- **The token never leaves the process.** It is read per operation and sent only in the Authorization header; never logged, rendered, injected, or surfaced in errors.
- **No writes outside approval.** `/pr create` never commits or pushes by itself; with `autoCommit: true`, the model performs those writes through the bash tool's own approval gate. The review job performs no writes; only `review_post` publishes, after approval.
- **Untrusted content is escaped and marked.** `formatPostBody` backtick- and HTML-escapes diff-derived file names, and external GitHub content (files, bodies, comments, search results) is marked as external in renders.
- **Bounded work and rate limits.** 429s are retried with backoff; the remaining quota is surfaced on every result, including failures.

## Known limitations

- **No custom session events** — deliberate (see Architecture); audit trails rely on the host's own event vocabulary.
- **Static analyzer by default** — deterministic rules (`src/review.ts`), zero tokens, reproducible. `reviewMode: "model"` costs tokens and requires the `subagents` seam and a registered provider.
- **Jobs and records are process-local** — the review report lives in plugin memory keyed by job id; the record map is capped by `maxReviewRecords` (oldest settled records evict first).
- **npm `latest` dist-tags are stale** — install through the profile closure `dsh-base` provides; never bare `npm i @deepseek-ai/dsh-tools`.

## Development

```sh
pnpm install             # node ^22.19 || >=24
pnpm run build           # tsc --noEmitOnError → lib/
pnpm run prepare         # self-contained git-install build (scripts/prepare.mjs)
pnpm run prepublishOnly  # build + test before publishing
pnpm test                # vitest run
pnpm run typecheck       # tsc --noEmit
pnpm run check:readmes   # cross-checks TOC anchors, tools, and config keys in all 5 READMEs
```

## Repository layout

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
src/tools.ts          the fourteen model-facing tools
src/commands.ts       /pr, /review, /issue
src/present.ts        pure UI-card presenters
test/                 vitest suite + mock host scaffolding + opt-in e2e smoke
cordis.patch.yml      bundle patch (one insert row)
scripts/prepare.mjs   self-contained git-install build
```

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `github` · `pull-request` · `code-review` · `issue-tracker`

## Contributors

- [@PerryLink](https://github.com/PerryLink) — creator and maintainer: the GitHub tool surface, approval gate, background review jobs, CI composite action, review bot, status-check gate, and the five-language docs.
- [@AraragiEro](https://github.com/AraragiEro) — the GitHub token settings card in the Plugins settings page (#6).
- [@alexchenzl](https://github.com/alexchenzl) — invited the plugin onto the DSH Directory (#5).

## PerryLink DSH Plugin Family

This project is one of the [33 DeepSeek Harness plugins](https://github.com/PerryLink) maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search | |
| **[dsh-dsh-data-quality](https://github.com/PerryLink/dsh-dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. | |
| **[dsh-dsh-fund-research](https://github.com/PerryLink/dsh-dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | Local document knowledge base for DeepSeek Harness. | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer | |
| **[dsh-dsh-mcp-panel](https://github.com/PerryLink/dsh-dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | |
| **[dsh-dsh-session-sync](https://github.com/PerryLink/dsh-dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. | |

## License

[Apache License 2.0](LICENSE) © 2026 dsh-github contributors
