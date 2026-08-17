<div align="center">

# dsh-github

**把 GitHub 的 PR、审查、issue 与 CI 接入 DeepSeek Harness —— 每个写操作都经人类审批，token 永不落日志。**

*在 agent 中创建、审查、合并与搜索 GitHub，附带 CI 复合动作、轮询式审查机器人与状态检查门禁。*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-github/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-github/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-github?label=version)](https://github.com/PerryLink/dsh-github/releases)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

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
- [PerryLink DSH 插件家族](#perrylink-dsh-插件家族)
- [许可证](#许可证)

## 兼容性

| 界面 | 状态 |
|---|---|
| Harness | DeepSeek Harness `0.1.0-rc.6`（兼容声明覆盖 `0.1.0-rc.5`–`0.1.0-rc.6`） |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Platforms | 全部（host 插件；出站网络访问 GitHub） |
| Model | 任意（静态审查是确定性的；`reviewMode: "model"` 为可选） |

## 你能得到什么

`dsh-github` 填补了 `dsh` 与 Claude Code、Codex 等工具之间的 GitHub 集成空白：你的 agent 能读取、审查、打开、更新与合并 pull request，读取仓库元数据与文件，评论与关闭 issue，以及搜索 —— 同时每个写操作都由人类审批，token 全程保密。

- **12 个工具** —— `pr_create`、`pr_merge`、`pr_update`、`gh_review`、`review_post`、`gh_issue`、`issue_open`、`issue_comment`、`issue_close`、`gh_search`、`gh_repo`、`gh_file`，全部经 `defineTool` 返回规范 JSON。
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
- **tarball 通道**：在本仓库执行 `pnpm pack`，然后 `dsh plugin --profile web add ./dsh-github-<version>.tgz`。
- **卸载**：`dsh plugin --profile web remove dsh-github`（或从 profile patch 中移除该行）。

## 配置

所有可调项都是 Schemastery `Config` 字段（可从 cordis.yml 修改）。以 id 定位的覆盖会替换整行 —— 需要重新声明你所需的每个键。`cordis.patch.yml` 逐键内联说明。

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
| `/pr create` | 命令 | 读取 git 状态并排队一条 `pr_create` 指令 |
| `/review` | 命令 | 启动 / 停止 / 发布后台审查 job |
| `/issue open` | 命令 | 排队一条 `issue_open` 指令 |
| `ci_run` | 工具 | 由复合动作 / CI 驱动执行的一次性 CI 审查 |
| 审查机器人 | 界面 | 带幂等行内评论的轮询式审查机器人（`ci.*`） |
| 状态检查门禁 | 界面 | 按 PR head commit 发布 `success` / `needs-changes` 结论（`action.yml`） |

## 架构

- **凭证接缝。** `tokenSource: auto` 每次操作按 credentials seam（`GITHUB_TOKEN` 引用）→ 环境变量 → `gh` CLI token 的顺序解析。该值只是交给 REST 客户端的局部变量，绝不进入规范值、渲染、卡片、命令输出、注入通知、job 输出、审批理由或错误消息。
- **审批门。** 所有写操作都经模型工具。`tools/pre-execute` waterfall 监听器对写工具返回 `ask`，注册表即通过 `ctx.approval` 询问人类（宿主落 `approval/asked` + `approval/decided` 审计对），无应答者时 fail-closed。命令从不直接写：写命令先收集只读上下文，再唤醒 agent，让模型在 turn 内调用受审批门保护的工具。
- **后台审查 job。** `/review <pr>` 在 `ctx.jobs` 上启动 `github-review` job；job 抓取元数据（记录 head-commit SHA 供行级发布）、截断 diff、CI 检查与既有评论，然后运行确定性多文件分析器（`src/review.ts`）。`reviewMode: "model"` 时改为把截断 diff 交给宿主 `subagents` 接缝的一次性 subagent。完成通知经宿主的 `dsh-tool-jobs` 消费者送回会话；模型用 `job_output` 读取、用 `review_post` 发布。
- **CI 复合动作 / 审查机器人 / 状态检查门禁。** 本仓库随附复合动作（`action.yml`），负责审查 PR、修复 CI 并产出报告；轮询式审查机器人发布幂等行内评论；状态检查门禁按 PR head commit 发布结论。一次性 `ci_run` 工具驱动 headless 运行。每个写操作都保持审批门控。

## 权限与数据

- **权限**：写操作走官方审批接缝；没有任何东西被重实现或绕过。插件在其 workshop manifest 中声明 `network:outbound` 与 `filesystem:write`。
- **数据**：审查报告按 job id 存于进程内存；不向磁盘写任何持久数据。
- **会话日志**：插件不新增任何自定义会话事件类型；所有模型可见内容都走宿主已记录的界面（`tool/result`、`user/message`、`command/run`、`approval/asked`…）。

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

## PerryLink DSH 插件家族

本项目是 [PerryLink](https://github.com/PerryLink) 维护的 [15 个 DeepSeek Harness 插件](https://github.com/PerryLink)之一。如果你觉得这个插件有用，其余的很可能同样有用：

| 插件 | 一句话说明 |
|---|---|
| [dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel) | 只读 MCP 运行时面板：/mcp 命令 + 设置页，状态/工具/错误一览 |
| [dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck) | 工程纪律守门：需求审讯、测试证据门、对抗评审 |
| [dsh-background-agents](https://github.com/PerryLink/dsh-background-agents) | 持久化后台子代理：Web 侧边栏进度、随时留言与打断 |
| [dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions) | 基于语言服务器的诊断/格式化/补全/代码动作/重命名 |
| [dsh-output-styles](https://github.com/PerryLink/dsh-output-styles) | 对标 Claude Code outputStyles 的运行时风格切换 |
| [dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind) | 对标 Claude Code /rewind：快照、会话 fork、一键回退 |
| [dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules) | Claude Code 风格声明式 allow/deny/ask 权限规则，带审计 |
| [dsh-auto-review](https://github.com/PerryLink/dsh-auto-review) | 审批链上的第二模型自动审查，默认 fail-closed |
| [dsh-memento](https://github.com/PerryLink/dsh-memento) | 带审批门的跨会话记忆：ctx.memory + SQLite + memory 工具 |
| [dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security) | 安全审计技能包：密钥扫描、依赖与供应链审查 |
| [dsh-session-pin](https://github.com/PerryLink/dsh-session-pin) | 在 Web 侧边栏置顶会话，持久排序 |
| [dsh-composer-history](https://github.com/PerryLink/dsh-composer-history) | Web 作曲器终端式输入历史：方向键、Ctrl+R 搜索 |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | DSH 的 GitHub PR/issue 集成，所有写操作经审批门 |
| [dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide) | 插件开发知识库，随 bundle 安装的按需 agent 技能 |
| [dsh-claude-move](https://github.com/PerryLink/dsh-claude-move) | 把 Claude Code 会话、记忆、技能和 CLAUDE.md 迁入 DSH |

## 许可证

[Apache License 2.0](LICENSE) © 2026 dsh-github contributors
