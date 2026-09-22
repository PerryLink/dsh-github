<div align="center">

# dsh-github

**把 GitHub 的 PR、审查、issue 与 CI 接入 DeepSeek Harness —— 每个写操作都经人类审批，token 永不落日志。**

*在 agent 中创建、审查、合并与搜索 GitHub，附带 CI 复合动作、轮询式审查机器人与状态检查门禁。*

> **官方仓库。** 本仓库是 dsh-github 的唯一官方仓库，由 PerryLink 维护。其他账号下的同名仓库与本项目无关。

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-github)
[![DSH plugin](https://img.shields.io/badge/dsh--plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-github.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-zh.svg)](https://dsh.market/)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-github/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-github/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-github?label=version)](https://github.com/PerryLink/dsh-github/releases)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)
- **1024 商店渠道**：先 `npm i -g dsh1024`，再 `dsh1024 plugin --profile web add @perrylink/dsh-github`（计入 [deepseek1024.com](https://deepseek1024.com) 安装排行）。
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

</div>

---

## 📚 目录

- [兼容性](#兼容性)
- [你能得到什么](#你能得到什么)
- [快速上手](#快速上手)
- [安装与卸载](#安装与卸载)
- [配置](#配置)
- [工具与界面](#工具与界面)
- [架构](#架构)
- [权限与数据](#权限与数据)
- [安全边界](#安全边界)
- [已知局限](#已知局限)
- [开发](#开发)
- [目录结构](#目录结构)
- [主题](#主题)
- [贡献者](#贡献者)
- [PerryLink DSH Plugin Family](#perrylink-dsh-plugin-family)
- [许可证](#许可证)

## 兼容性

| 界面 | 状态 |
|---|---|
| Harness | DeepSeek Harness `dsh-v0.1.7-alpha.1`（兼容声明覆盖 `>=0.1.2-rc.1 <0.2.0 \|\| >=0.1.5-alpha.1 <0.2.0 \|\| >=0.1.6-0 <0.2.0`；0.1.2-rc.1 于 2026-09-09 已适配）：评审任务改由裸 `SessionId` 归属、通知来源改为插件自有的 `dsh-github` kind（宿主的 `Agent \| SessionId` 联合与兜底 `kind: 'plugin'` 均已移除）；设置卡注册在 **Plugins 页**（Official 组，`plugins.item` 槽），并从 `dsh-client-ui-plugin-manager` 提供的 owner form 渲染，不再绑定已删除的 `ctx.settingsScope`；CI 驱动器通过官方 `ctx.approval.setPolicy` 策略缝自动放行；评审机器人以 `ctx.jobs` 后台任务轮询，并带定时器降级。2026-09-22 升级至 `0.1.7-alpha.1`（typecheck + typecheck:ci + 185 项单元测试全绿）。 |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Platforms | 全部（host 插件；出站网络访问 GitHub） |
| Model | 任意（静态审查是确定性的；`reviewMode: "model"` 为可选） |

## 你能得到什么

`dsh-github` 填补了 `dsh` 与 Claude Code、Codex 等工具之间的 GitHub 集成空白：你的 agent 能读取、审查、打开、更新与合并 pull request，读取仓库元数据与文件，评论与关闭 issue，以及搜索 —— 同时每个写操作都由人类审批，token 全程保密。

- **14 个工具** —— `pr_create`、`pr_merge`、`pr_update`、`gh_review`、`review_post`、`gh_issue`、`issue_open`、`issue_comment`、`issue_close`、`gh_search`、`gh_repo`、`gh_file`、`gh_repo_search`、`gh_checks`，全部经 `defineTool` 返回规范 JSON。
- **3 族命令** —— `/pr create`、`/review`（启动/停止/发布）、`/issue open`。
- **完整 PR 生命周期** —— 创建 → 审查 → 更新（标题/正文/状态/目标分支）→ 合并（merge/squash/rebase，可选合并后删源分支）。
- **行级审查** —— `review_post` 可发布单条汇总评论，或按行锚定 PR head commit 的行级审查评论。
- **写操作审批** —— 每个 GitHub 写操作都经 `ctx.approval`（默认 `ask`，fail-closed）；审批理由预览标题、正文长度与评论覆盖内容。
- **token 保密** —— credentials seam → 环境变量 → `gh` CLI，逐操作解析，绝不进日志、事件、渲染或错误。
- **后台审查 job** —— `/review` 跑在 `ctx.jobs` 上，复用宿主自带 `job_list` / `job_output` / `job_kill` 工具面。
- **韧性** —— 按 `Retry-After`/`x-ratelimit-reset` 退避重试 429；读工具并发安全；所有调用尊重取消信号。
- **CI 界面** —— 一次性 `ci_run` 工具、轮询式审查机器人与状态检查门禁（复合动作 `action.yml`）。

## 快速上手

```sh
# 1. 将 bundle 安装进你的 profile
dsh plugin --profile web add "github:PerryLink/dsh-github#main"

# 或从 npm 安装（已发布版本）
dsh plugin --profile web add @perrylink/dsh-github

# 2. 重启并验证该行
dsh --profile web --dump-config | grep -A3 'id: dsh-github'
```

## 安装与卸载

- **git 通道**（最新 `main`）：`dsh plugin --profile web add "github:PerryLink/dsh-github#main"` —— `prepare` 脚本仅以生产依赖构建。
- **npm 通道**（已发布版本）：`dsh plugin --profile web add @perrylink/dsh-github`。
- **tarball 通道**：在本仓库执行 `pnpm pack`，然后 `dsh plugin --profile web add ./perrylink-dsh-github-<version>.tgz`。
- **卸载**：`dsh plugin --profile web remove @perrylink/dsh-github`（或从 profile patch 中移除该行）。

## 配置

所有可调项都是 Schemastery `Config` 字段（可从 cordis.yml 修改）。以 id 定位的覆盖会替换整行 —— 需要重新声明你所需的每个键。`cordis.patch.yml` 逐键内联说明。在图形界面中，**Plugins 页设置卡**（Official 组）从该条目自己的配置表单读取 `tokenRef`：`0.1.7-alpha.1` 宿主已删除 `ctx.settingsScope` 绑定及其背后的命名空间注册缝，卡片因此不再拥有设置命名空间。GitHub 令牌根本不是配置字段：卡片只报告所引用凭证是否已配置，并通过凭证文件写入它——宿主半部正是从那里解析的。

| 键 | 默认值 | 含义 |
|---|---|---|
| `tokenSource` | `auto` | `auto`（credentials → env → gh）或指定 `credentials` / `env` / `gh` |
| `tokenRef` | `GITHUB_TOKEN` | credentials seam 引用名 / 环境变量名 |
| `defaultOwnerRepo` | — | 调用未指定且 git 无 origin 时的兜底 `owner/repo` |
| `autoCommit` | `false` | `/pr create` 是否允许指示模型先 commit+push |
| `maxDiffChars` | `8000` | 审查读取 PR diff 的字符数上限 |
| `renderExcerptChars` | `2000` | 渲染进工具输出的 diff 摘要字符数上限 |
| `maxComments` | `20` | `gh_review` 列出 PR 评论的上限 |
| `reviewJobTimeoutMs` | `600000` | 单个后台审查 job 的截止时间（超时以 `timeout` 失败） |
| `maxReviewRecords` | `50` | 内存审查 job 记录上限；最旧的已终态记录先淘汰 |
| `maxFileChars` | `12000` | `gh_file` 读取文件内容的字符数上限 |
| `maxFindings` | `50` | 每次审查分析器发现数上限 |
| `maxLineLength` | `300` | 行长度超过该值时分析器报超长行发现 |
| `reviewMode` | `static` | 评审引擎：`static`（确定性分析器）或 `model`（经宿主 `subagents` 接缝的一次性 subagent；接缝缺失时响亮失败） |
| `modelReviewProvider` | — | `reviewMode: "model"` 使用的 subagent provider 名；缺省用第一个注册的 provider |
| `maxRetries` | `3` | 单请求的 429 重试次数 |
| `retryBaseMs` | `500` | 重试退避基数（逐次翻倍） |
| `retryMaxWaitMs` | `60000` | 重试退避上限 |
| `requestTimeoutMs` | `30000` | 单次请求硬超时；超时即中止 fetch |
| `apiBaseUrl` | `https://api.github.com` | GitHub REST 基地址（GitHub Enterprise） |
| `allowedActions` | `['pr.create','pr.merge','pr.update','review.post','issue.create','issue.comment','issue.close','ci.run']` | 写动作白名单；名单外直接拒绝 |
| `workspaceDir` | 进程 cwd | 只读 git 检查的工作目录 |
| `ci` | `{ enabled: false, … }` | CI 集成段：轮询式审查机器人、状态检查门禁与一次性 `ci_run` 工具（其下为全部 `ci.*` 子键） |

## 工具与界面

| 界面 | 类型 | 说明 |
|---|---|---|
| `pr_create` | 工具 | 创建 pull request（写；审批门控） |
| `pr_merge` | 工具 | 合并 PR（merge/squash/rebase，可选删源分支） |
| `pr_update` | 工具 | 更新 PR（标题/正文/状态/目标分支） |
| `gh_review` | 工具 | 读取 PR：元数据、截断 diff、评论、CI、静态发现 |
| `review_post` | 工具 | 发布审查评论（汇总或行级锚定） |
| `gh_issue` | 工具 | 列出 / 获取 / 评论 issue（PR 标记为 `kind: "pr"`） |
| `issue_open` | 工具 | 创建 issue |
| `issue_comment` | 工具 | 评论 issue 或 PR |
| `issue_close` | 工具 | 关闭 issue（可选关闭原因） |
| `gh_search` | 工具 | 搜索 issue 与 PR（独立搜索配额） |
| `gh_repo` | 工具 | 读取仓库元数据 |
| `gh_file` | 工具 | 按分支/tag/commit 读取单个文件 |
| `gh_repo_search` | 工具 | GraphQL 仓库搜索（独立搜索配额） |
| `gh_checks` | 工具 | GraphQL PR 状态检查（check runs + commit statuses） |
| `/pr create` | 命令 | 读取 git 状态并排队一条 `pr_create` 指令 |
| `/review` | 命令 | 启动 / 停止 / 发布后台审查 job |
| `/issue open` | 命令 | 排队一条 `issue_open` 指令 |
| `ci_run` | 工具 | 由复合动作 / CI 驱动执行的一次性 CI 审查 |
| 审查机器人 | 界面 | 带幂等行内评论的轮询式审查机器人（`ci.*`） |
| 状态检查门禁 | 界面 | 按 PR head commit 发布 `success` / `needs-changes` 结论（`action.yml`） |

## 架构

- **凭证接缝。** `tokenSource: auto` 每次操作按 credentials seam（`GITHUB_TOKEN` 引用）→ 环境变量 → `gh` CLI token 的顺序解析。该值只是交给 REST 客户端的局部变量，绝不进入规范值、渲染、卡片、命令输出、注入通知、job 输出、审批理由或错误消息。
- **审批门。** 所有写操作都经模型工具。`tools/pre-execute` waterfall 监听器对写工具返回 `ask`，注册表即通过 `ctx.approval` 询问人类（宿主落 `approval/asked` + `approval/decided` 审计对），无应答者时 fail-closed。命令从不直接写：写命令先收集只读上下文，再唤醒 agent，让模型在 turn 内调用受审批门保护的工具。
- **后台审查 job。** `/review <pr>` 在 `ctx.jobs` 上启动 `github-review` job；job 抓取元数据（记录 head-commit SHA 供行级发布）、截断 diff、CI 检查与既有评论，然后运行确定性多文件分析器（`src/review.ts`）。该 job 由调用 agent 的裸 `SessionId` 归属 —— `0.1.7-alpha.1` 的注册表以 `SessionId` 做访问围栏、不再接受 `Agent` 联合 —— 因此必须组合 `dsh-tool-jobs`，否则 `start` 会直接拒绝。`reviewMode: "model"` 时改为把截断 diff 交给宿主 `subagents` 接缝的一次性 subagent。完成通知经宿主的 `dsh-tool-jobs` 消费者送回会话；模型用 `job_output` 读取、用 `review_post` 发布。
- **CI 复合动作 / 审查机器人 / 状态检查门禁。** 本仓库随附复合动作（`action.yml`），负责审查 PR、修复 CI 并产出报告；轮询式审查机器人发布幂等行内评论；状态检查门禁按 PR head commit 发布结论。一次性 `ci_run` 工具驱动 headless 运行。每个写操作都保持审批门控。

## 权限与数据

- **权限**：写操作走官方审批接缝；没有任何东西被重实现或绕过。插件在其 workshop manifest 中声明 `network:outbound` 与 `filesystem:write`。
- **数据**：审查报告按 job id 存于进程内存；不向磁盘写任何持久数据。
- **会话日志**：插件不新增任何自定义会话事件类型；所有模型可见内容都走宿主已记录的界面（`tool/result`、`user/message`、`command/run`、`approval/asked`…）。命令排队的通知携带插件自己的可合并来源 kind `{ kind: 'dsh-github', form: 'notice', summary }` —— 宿主没有兜底的 `plugin` kind，其会话格式准入路径会直接拒绝。

## 安全边界

- **审批而非强制执行。** 写操作只在官方接缝上产生 `ask`/deny 决策；沙箱与审批系统仍是执行权威。
- **Fail closed。** 缺少审批应答者时退化为最严格决策 —— 绝不静默放行。
- **token 不离开进程。** 逐操作读取，只写入 Authorization 头；从不落日志、渲染、注入或出现在错误中。
- **审批之外无写操作。** `/pr create` 自己从不 commit/push；`autoCommit: true` 时模型经 bash 工具自身的审批门执行这些写操作。审查 job 零写操作；只有 `review_post` 在审批后发布。
- **不可信内容被转义与标记。** `formatPostBody` 对 diff 派生的文件名做反引号与 HTML 转义，外部 GitHub 内容（文件、正文、评论、搜索结果）在渲染中被标记为外部内容。
- **有界工作与配额。** 429 带退避重试；剩余配额在包括失败在内的每个结果上对模型可见。

## 已知局限

- **无自定义会话事件** —— 刻意为之（见架构）；审计依赖宿主自有事件词汇。
- **默认静态分析器** —— 确定性规则集（`src/review.ts`），零 token、可复现。`reviewMode: "model"` 消耗 token，且需要 `subagents` 接缝与已注册的 provider。
- **job 与记录是进程内状态** —— 审查报告按 job id 存于插件内存；记录表受 `maxReviewRecords` 上限约束（最旧已终态记录先淘汰）。
- **npm `latest` 标签过期** —— 请通过 `dsh-base` 提供的 profile 闭包安装；不要裸跑 `npm i @deepseek-ai/dsh-tools`。

## 开发

```sh
pnpm install             # node ^22.19 || >=24
pnpm run build           # tsc --noEmitOnError → lib/
pnpm run prepare         # 自包含 git 安装构建（scripts/prepare.mjs）
pnpm run prepublishOnly  # 发布前构建 + 测试
pnpm test                # vitest run
pnpm run typecheck       # tsc --noEmit
pnpm run check:readmes   # 交叉检查 5 个 README 的目录锚点、工具与配置键
```

## 目录结构

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

## 主题

`dsh` · `dsh-plugin` · `deepseek-harness` · `github` · `pull-request` · `code-review` · `issue-tracker`

## 贡献者

- [@PerryLink](https://github.com/PerryLink) —— 创建者与维护者：GitHub 工具面、审批门、后台审查 job、CI 复合动作、审查机器人、状态检查门禁，以及五语文档。
- [@AraragiEro](https://github.com/AraragiEro) —— 插件设置页的 GitHub token 设置卡片（#6）。
- [@alexchenzl](https://github.com/alexchenzl) —— 邀请本插件收录到 DSH Directory（#5）。

## PerryLink DSH Plugin Family

This project is one of the **45 DeepSeek Harness plugins** maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default | |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command | |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | |
| **[dsh-catalog](https://github.com/PerryLink/dsh-catalog)** | DSH Desktop Market standard catalog source for the PerryLink family | |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence | |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore | |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. | |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search | |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) | |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review | |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. | |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds | |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval | |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` | |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools | |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. | |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. | |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers | |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer | |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors | |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool | |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. | |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching | |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit | |
| **[dsh-plugin-certification](https://github.com/PerryLink/dsh-plugin-certification)** | Community certification registry with repro-checkable grades and badges | |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins | |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill | |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins | |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card | |
| **[dsh-plugin-upgrade-015](https://github.com/PerryLink/dsh-plugin-upgrade-015)** | Merged `0.1.3-alpha.1` → `0.1.5-rc.1` upgrade corridor card plus a zero-dependency seam scanner | |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions | |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. | |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. | |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review | |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. | |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. | |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools | |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. | |


### 从 DSH Desktop 市场安装

所有 PerryLink 插件均可在 DSH Desktop 内置市场中浏览：**市场 → 来源 → 添加来源 → 粘贴** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ 选中**。安装仍需通过市场的 npm 身份校验与你的确认。

## 许可证

[Apache License 2.0](LICENSE) © 2026 dsh-github contributors
