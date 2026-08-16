<h1 align="center">dsh-github</h1>

<p align="center">
  <b>把 GitHub 接入 DeepSeek Harness。</b><br/>
  创建 PR · 行级或汇总评论审查 PR · 管理 issue · 搜索 —— 每个写操作都经人类审批，token 永不落日志。
</p>

<p align="center">
  <a href="README.md">English</a> ·
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
  <a href="https://www.npmjs.com/package/@perrylink/dsh-github"><img src="https://img.shields.io/npm/v/@perrylink/dsh-github" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@perrylink/dsh-github"><img src="https://img.shields.io/npm/dm/@perrylink/dsh-github" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/documents-EN%2FZH%2FES%2FPT%2FHI-8257D0" alt="Documents: EN/ZH/ES/PT/HI">
</p>

---

**dsh-github** 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`，"一切皆插件"的 agent 框架）的 bundle 插件。它填补了 dsh 相对 [Claude Code](https://github.com/anthropics/claude-code)（`gh claude` / [claude-code-action](https://github.com/anthropics/claude-code-action)）与 [Codex](https://github.com/openai/codex)（`@codex review` / Autofix CI）的 GitHub 集成空白：agent 能**看 PR、审 PR、开 PR、合并与更新 PR、读仓库元数据与文件、评论与关闭 issue、搜索**——写操作由人类审批，token 全程保密。

- 🛠 **12 个工具** —— `pr_create` · `pr_merge` · `pr_update` · `gh_review` · `review_post` · `gh_issue` · `issue_open` · `issue_comment` · `issue_close` · `gh_search` · `gh_repo` · `gh_file`，全部经 `defineTool` 返回规范 JSON
- ⌨️ **3 族命令** —— `/pr create` · `/review`（启动/停止/发布）· `/issue open`
- 🔀 **完整 PR 生命周期** —— 创建 → 审查 → 更新（标题/正文/状态/目标分支）→ 合并（merge/squash/rebase，可选合并后删源分支）
- 📝 **行级审查评论** —— `review_post` 既可发布单条汇总评论，也可按行锚定到 PR head commit 发布行级 review 评论
- 🔒 **写操作审批** —— 每个 GitHub 写操作都经 `ctx.approval`（默认 `ask`，fail-closed）；审批理由预览标题、正文长度与评论覆盖内容
- 🗝 **token 保密** —— credentials seam → 环境变量 → `gh` CLI 三级解析，逐操作执行，绝不进日志/事件/渲染/错误
- ⏱ **后台审查 job** —— `/review` 跑在 `ctx.jobs` 上，复用宿主自带 `job_list` / `job_output` / `job_kill` 工具面；输出除发现外还带 CI 状态与既有评论数
- 🤖 **可选模型评审** —— `reviewMode: "model"` 把截断后的 diff 交给宿主 `subagents` 接缝的一次性 subagent 评审；默认 `static` 模式保持确定性、零 token
- 🚦 **429 退避 + 配额可见** —— 每个结果（含失败）都向模型暴露剩余配额；各分节抓取失败显式上报，不再静默吞掉
- 🌐 **5 语文档** —— English · 中文 · Español · Português · हिन्दी

---

## 📚 目录

- [快速上手](#🚀-快速上手)
- [特性](#✨-特性)
- [安装](#📦-安装)
- [配置](#⚙️-配置)
- [工具](#🛠-工具)
- [命令](#⌨️-命令)
- [架构](#🏗-架构)
- [安全边界](#🔒-安全边界)
- [已知局限](#⚠️-已知局限)
- [开发](#🧪-开发)
- [目录结构](#🗂-目录结构)
- [Topics](#🏷-topics)
- [贡献者](#贡献者)
- [许可证](#许可证)
- [PerryLink DSH 插件家族](#perrylink-dsh-插件家族)

## 🚀 快速上手

```sh
# 1. 安装（npm registry —— 最简单；也可用下方 tarball 通道）
dsh plugin --profile <name> add @perrylink/dsh-github
#    tarball 通道（不需要 registry）：
#    pnpm pack → dsh-github-<version>.tgz
#    dsh plugin --profile <name> add ./dsh-github-<version>.tgz

# 2. 配置 GitHub token（推荐：credentials seam）
#    $DSH_HOME/.credentials.yaml
#    GITHUB_TOKEN: <你的 token>

# 3. 使用 —— dsh Web UI 或 headless 均可
#    /pr create "add dark mode"      → agent 起草并创建 PR（需审批）
#    /review 42                      → 后台审查 job，用 job_output 读结论
#    /review post github-review-1    → 发布审查评论（需审批）
#    /issue open "crash on startup"  → agent 创建 issue（需审批）
```

验证：`dsh --profile <name> --dump-config` 应显示 `# == dsh-github` 段且**无 FAILED 行**。

## ✨ 特性

| 领域 | 你能得到什么 |
|---|---|
| **创建 PR** | `/pr create [标题]` 读取 git 状态（分支、变更文件、未推送提交），把草稿交给 agent；`pr_create` 创建 PR 并返回 URL |
| **更新 PR** | `pr_update` 修改标题、正文、状态或目标分支——与其它写操作一样经审批门 |
| **合并 PR** | `pr_merge` 以 `merge`/`squash`/`rebase` 合并，可选提交标题/消息与合并后删除源分支 |
| **审查 PR** | `gh_review` 汇总元数据、截断 diff（canonical 值含完整 diff 文本、渲染面为有界摘要）、评论、CI 状态与静态发现；各分节抓取失败以 `diff.error` / `comments.error` / `ci.error` 显式上报 |
| **发布审查** | `review_post` 发布单条 issue 级汇总评论（`mode: "summary"`，默认）或按行锚定 PR head commit 的行级评论（`mode: "inline"`）；`body` 覆盖参数让模型先润色评论——发布前必须审批 |
| **后台审查** | `/review <pr>` 在 `ctx.jobs` job 内抓取元数据、截断 diff、CI 检查与既有评论；完成输出带发现汇总、CI 状态与评论数。`reviewMode: "model"` 改为把 diff 交给一次性 subagent 评审 |
| **读仓库** | `gh_repo` 读取仓库元数据：描述、默认分支、可见性、star、fork、开放 issue、语言、license、topics |
| **读文件** | `gh_file` 按分支/tag/commit 读取单个文件，base64 解码、上限可配；目录返回结构化错误 |
| **读取 issue** | `gh_issue` 支持 list / get / comments；列表中的 PR 以 `kind: "pr"` 标记 |
| **管理 issue** | `issue_open` 创建、`issue_comment` 评论（对 PR 同样可用）、`issue_close` 关闭并可选记录关闭原因——全部审批门控 |
| **搜索** | `gh_search` 以 GitHub 搜索语法查询 issue 与 PR，暴露独立的搜索配额 |
| **审批** | `tools/pre-execute` 对每个写操作向 `ctx.approval` 发起 `ask`；`allowedActions` 白名单在询问前拒绝 |
| **密钥安全** | token 逐操作读取、只写入 Authorization 头；专项测试断言它不出现在任何可见输出中 |
| **韧性** | 按 `Retry-After`/`x-ratelimit-reset` 退避重试 429；读工具并发安全；所有调用尊重取消信号 |
| **可观测** | 模型可见 ⟺ 已记录：模型看到的一切都经宿主自有会话事件（`tool/result`、`user/message`、`command/run`、`approval/asked`…） |

## 📦 安装

四条通道，全部有文档——任选其一。

| 通道 | 命令 | 说明 |
|---|---|---|
| **npm registry** | `dsh plugin --profile <name> add @perrylink/dsh-github` | 已发布到 npm —— 最简单的通道 |
| **npm tarball** | `dsh plugin --profile <name> add ./dsh-github-<version>.tgz` | 自带构建好的 `lib/`——无需构建许可 |
| **git 源** | `dsh plugin --profile <name> add "github:PerryLink/dsh-github#<sha>"` | 需 `prepare` + `allowBuilds`（见下）；请钉住 commit |
| **本地 link** | `pnpm link --dir .` 后 `dsh plugin add @perrylink/dsh-github` | 开发用 |

> npm 包发布在 `@perrylink` 作用域下，因为裸名 `dsh-github` 已被 registry 上另一个无关项目占用。插件模块名仍是 `dsh-github`。

git 安装：pnpm ≥10 默认拒绝运行 git 依赖的 `prepare`，直到放行——`dsh` 会打印确切包键，复制进 profile 的 `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  '@perrylink/dsh-github': true
```

`prepare` 脚本（`scripts/prepare.mjs`）自包含：能找到 TypeScript 编译器就构建，否则回退到**仓库内已提交的 `lib/` 产物**，两者都没有才响亮失败。

**卸载：** `dsh plugin --profile <name> remove @perrylink/dsh-github`。

## ⚙️ 配置

加载期由 Schemastery 校验（非法即响亮失败）。可在 profile 的 `cordis.patch.yml` 覆盖任意键（整行 config 被替换，不深合并）。

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

## 🛠 工具

| 工具 | 类型 | 参数 | 返回 |
|---|---|---|---|
| `pr_create` | 写 | `title*`、`body?`、`base?`、`head?`、`draft?`、`ownerRepo?` | `{status:'created', url, number, title, state, draft, base, head, rateLimit}` 或结构化错误 |
| `pr_merge` | 写 | `pr*`（数字 / `#n` / `o/r#n` / URL）、`mergeMethod?`、`commitTitle?`、`commitMessage?`、`deleteBranch?` | `{status:'merged', merged, sha?, message, url, branchDeleted, branchDeleteNote?, rateLimit}` 或结构化错误 |
| `pr_update` | 写 | `pr*`（数字 / `#n` / `o/r#n` / URL）、`title?`、`body?`、`state?`（`open`/`closed`）、`base?` | `{status:'updated', url, number, title, state, base, rateLimit}` 或结构化错误 |
| `gh_review` | 读 | `pr*`（数字 / `#n` / `o/r#n` / URL）、`fields?`、`maxDiffChars?` | 元数据、截断 diff（完整 `diff.text` + 有界 `diff.excerpt` + 逐文件统计）、评论、CI、静态发现、各分节 `error` 字段、配额 |
| `gh_repo` | 读 | `ownerRepo?` | `{repo, description, defaultBranch, visibility, stars, forks, openIssues, language, license, topics, url, updatedAt, rateLimit}` 或结构化错误 |
| `gh_file` | 读 | `ownerRepo?`、`path*`、`ref?`、`maxChars?` | `{repo, path, ref, size, truncated, content, sha, url, rateLimit}` 或结构化错误 |
| `gh_issue` | 读 | `action*`（`list`/`get`/`comments`）、`ownerRepo?`、`issueNumber?`、`state?`、`limit?` | 归一化条目（每条带 `kind: issue/pr/comment`）+ 配额 |
| `review_post` | 写 | `jobId*`、`mode?`（`summary`/`inline`）、`body?` | `{status:'posted', mode, url, commentId?, reviewId?, findings, rateLimit}` 或结构化错误 |
| `issue_open` | 写 | `title*`、`body?`、`labels?`、`ownerRepo?` | `{status:'created', url, number, title, rateLimit}` 或结构化错误 |
| `issue_comment` | 写 | `issueNumber*`、`body*`、`ownerRepo?` | `{status:'commented', url, commentId, issueNumber, rateLimit}` 或结构化错误 |
| `issue_close` | 写 | `issueNumber*`、`ownerRepo?`、`stateReason?`（`completed`/`not_planned`） | `{status:'closed', url, number, title, rateLimit}` 或结构化错误 |
| `gh_search` | 读 | `q*`、`sort?`、`order?`、`perPage?` | `{query, total, items[{number,title,state,kind,author,url,repo,comments,createdAt}], rateLimit}` 或结构化错误 |

`execute` 只返回 `output.schema` 声明的规范 JSON。缺 token 与 GitHub API 失败是携带配额事实的结构化错误分支，基础设施故障抛出（→ `isError`）。全程尊重 `exec.signal`。

## ⌨️ 命令

| 命令 | 效果 |
|---|---|
| `/pr create [标题]` | 读取 git 状态并为模型排队 `pr_create` 指令（描述草稿、默认值；除非 `autoCommit`，否则不 commit/push）。创建 PR 需审批。 |
| `/review <pr>` | 启动后台审查 job 并打印 job id；完成后宿主会通知，用 `job_output` 读取。 |
| `/review <pr> --max-diff <n> --no-ci --no-comments` | 单 job 覆盖：diff 上限与是否抓取补充分节。 |
| `/review stop <jobId>` | 取消 job（本地控制，非 GitHub 写操作）。 |
| `/review post <jobId>` | 为模型排队 `review_post` 指令（汇总或行级）；发布需审批。 |
| `/issue open <标题>` | 为模型排队 `issue_open` 指令；创建需审批。 |

## 🏗 架构

```
                    ┌───────────────────────────────────────────────┐
                    │                   dsh-github                  │
                    │                                               │
 人类 ─── /pr ──────┼──► git 读取（只读）──► agent.followup         │
         /review ───┼──► ctx.jobs.start("github-review") ──► job    │
         /issue ────┼──► agent.followup                              │
                    │                                               │
 模型 ─── pr_create / pr_merge / pr_update / gh_review /            │
           review_post / gh_issue / issue_open / issue_comment /    │
           issue_close / gh_search / gh_repo / gh_file              │
           （defineTool，只返回规范 JSON）                            │
                    │                                               │
                    └───────┬───────────────┬───────────────┬───────┘
                            │               │               │
                  tools/pre-execute    凭证解析          GitHub REST
                  审批门（ask|deny）  （seam→env→       客户端（fetch、
                                     gh CLI，逐次解析） 429 重试、配额）
```

- **凭证接缝。** `tokenSource: auto` 每次操作按「credentials seam 引用（`GITHUB_TOKEN`）→ 环境变量 → `gh` CLI 登录态」顺序解析。token 值只是交给 REST 客户端的局部变量，绝不进入规范值、渲染文本、UI 卡片、命令输出、注入通知、job 输出、审批理由或错误消息。
- **审批。** 所有写操作都经模型工具。`tools/pre-execute` waterfall 监听器对七个写工具返回 `ask`，注册表即通过 `ctx.approval` 询问人类（宿主自动落 `approval/asked` + `approval/decided` 审计对），无应答者时 fail-closed。审批理由预览将要发布的内容（标题、正文长度、合并方式、覆盖评论的首行）。命令本身从不直接写：命令 handler 运行时没有开启的 turn，审批 seam 对命令在结构上不可用——写命令先收集只读上下文，再唤醒 agent（空闲 `followup`、忙碌 `inject`），让模型在 turn 内调用受审批门保护的工具。
- **后台审查。** `/review <pr>` 在 `ctx.jobs` 上启动 `github-review` job（label、owner、超时、可取消）。job 逐操作解析 token，抓取 PR 元数据（记录 head-commit SHA，供行级发布使用）、截断后的 diff，以及（除非关闭）CI 检查与既有评论，然后运行确定性的多文件静态分析器（`src/review.ts`：硬编码密钥、Google API key、凭证赋值、调试语句、eval、TODO 标记、超长行、超大改动）——零 token、完全可测。`reviewMode: "model"` 时，job 改为把截断后的 diff 交给宿主 `subagents` 接缝的一次性 subagent（parent 为发起 job 的 agent），把子 agent 的 Markdown 输出存为可发布的报告；接缝或 provider 缺失时响亮失败。补充分节抓取失败只在输出中注明，不使 job 失败。完成通知由宿主的 `dsh-tool-jobs` 消费者送回发起会话；模型用自带 `job_output` 工具读取结论，用 `review_post` 发布——发布前必须审批。
- **模型可见 ⟺ 已记录。** 本插件**不新增任何自定义会话事件类型**。仓库外插件的事件类型不在宿主 `KNOWN_SESSION_EVENT_TYPES` 中，未知的 required 事件会让宿主拒绝读取会话日志（宿主明确把外部插件事件注册面推迟到未来）。因此所有模型可见内容都走宿主已记录的表面：`tool/result` 规范值、经 `agent.inject`/`agent.followup` 的 `user/message` 通知、`command/run` + `command/done` 生命周期对、`approval/asked` + `approval/decided` 审计对。
- **纯 presenter。** `presentCall`/`presentResult` 是 `args`（+ 持久化的 `result.meta`）的纯函数，实时流与日志回放行为一致。PR 创建结果以 generic 卡片展示 PR 链接。

## 🔒 安全边界

- token 逐操作从配置的源（credentials seam、环境变量或 `gh` CLI）读取，只写入 REST 客户端的 Authorization 头；从不落日志、不渲染、不注入、不进会话日志、不进错误消息。
- 每次 GitHub 写操作都需要 `ctx.approval` 的 `allowed-once`（默认策略 `ask`）；`rejected`、`cancelled`、`unavailable` 一律 fail-closed。
- `/pr create` 自己从不 commit/push；`autoCommit: true` 时模型通过 bash 工具（其自身审批门）执行这些写操作。dsh-github **不**管理 git 提交身份（dsh-git-identity 的职责）、**不**做 worktree（dsh-worktree 的职责）。
- 审查 job 零写操作：只读 diff、把报告存进进程内存；只有 `review_post` 在审批后发布。
- 发布的评论会插入 diff 中的文件名——这是不可信的仓库内容：`formatPostBody` 对文件名做反引号转义与 HTML 转义，恶意 PR 无法向审查评论注入 Markdown。
- `gh_file` 读到的文件内容以及从 GitHub 读到的 issue/PR 正文、评论与搜索结果都是进入模型上下文的外部不可信内容——与网页抓取同属固有权衡；插件在渲染中把它们标注为外部内容。
- 配额：429 带退避重试，剩余配额在包括失败在内的每个结果上对模型可见。

## ⚠️ 已知局限

- **无自定义会话事件** —— 刻意为之（见架构）；审计依赖宿主自有事件词汇。
- **默认静态分析器** —— 确定性规则集（`src/review.ts`），零 token、可复现。`reviewMode: "model"` 会把截断后的 diff 交给宿主 `subagents` 接缝的一次性 subagent 做 LLM 评审（消耗 token；需要接缝与已注册的 provider）。
- **job 与记录是进程内状态** —— 审查报告按 job id 存于插件内存，与宿主 job 注册表同为进程级生命周期；记录表受 `maxReviewRecords` 上限约束（最旧已终态记录先淘汰）。
- **npm `latest` 标签过期** —— 本插件用 `^0.1.0-rc.5` peer 范围对齐 `dsh-base` 提供的 profile 闭包，开发时钉 `0.1.0-rc.6`。不要裸跑 `npm i @deepseek-ai/dsh-tools`。
- **CI / GitHub Action** — 随本仓库发布（v0.6.0）：复合动作（`action.yml`）负责审查 PR、修复 CI 并产出报告；轮询式审查机器人带幂等行内评论；外加状态检查门禁。所有写动作仍需审批。

## 🧪 开发

```sh
pnpm install
pnpm test          # vitest：配置、凭证、429 重试、工具、命令、job、审批门、token 不泄露
pnpm typecheck
pnpm build         # tsc → lib/（noEmitOnError）
pnpm pack          # 可安装 tarball
pnpm run check:readmes   # 交叉检查 5 个 README 的目录锚点、工具与配置键
```

测试通过注入的 runner mock 掉 GitHub API、`gh` CLI 与 git——不联网、不用真实凭证。`test/security.test.ts` 断言 token 字符串不出现在任何模型或人类可见输出中。`test/e2e.test.ts` 是可选真实 API 冒烟测试：未设置 `DSH_GITHUB_E2E_TOKEN` 时自动跳过（只打只读端点；独立变量保证单测套件与环境隔离）。

要在本地演练 composite action，运行 `node scripts/local-test.mjs --owner-repo you/repo --pr 42`（全部选项见 `--help`）。模拟器为每个子进程显式写死 `DSH_HOME`、`DSH_PROFILE_DIR`、`RUNNER_TEMP` 与输出目录——全部位于全新的系统临时目录沙箱内，即使存在 Machine 级 `DSH_HOME` 也绝不读写你真实的 dsh home——并按 `action.yml` 的顺序回放 install → prepare → headless run → post 四步。`action-patch.mjs` 与 `action-post.mjs` 在 GitHub Actions runner 之外一律拒绝运行，因此 action 不会把 profile overlay 或报告写到未知的本地位置。

## 🗂 目录结构

```
src/index.ts          插件入口（name/inject/apply，applyWithDeps 供测试注入）
src/config.ts         Schemastery 配置
src/types.ts          宿主服务的最小结构视图 + Context 声明合并
src/credential.ts     token 解析（seam → env → gh），逐操作解析
src/github.ts         REST 客户端：429 重试、配额、diff 媒体类型
src/git.ts            只读 git 检查 + 任意 API 主机的 origin 解析
src/review.ts         确定性 diff 分析器 + 转义后的评论草稿
src/jobs.ts           github-review 后台 job 生产者（元数据 + diff + CI + 评论）
src/approval-gate.ts  tools/pre-execute ask/deny 门（带写操作预览）
src/tools.ts          十二个模型可调工具
src/commands.ts       /pr、/review、/issue
src/present.ts        纯 UI 卡片 presenter
test/                 vitest 套件 + mock 宿主脚手架 + 可选 e2e 冒烟
cordis.patch.yml      bundle patch（单行 insert）
scripts/prepare.mjs   git 安装用的自包含构建
```

## 🏷 Topics

推荐的 GitHub 仓库 Topics（在仓库设置里添加——它们驱动 [`dsh-plugin` 话题页](https://github.com/topics/dsh-plugin) 与各 DSH 插件市场）：

`dsh` · `dsh-plugin` · `deepseek-harness` · `github` · `pull-request` · `code-review` · `issue-tracker`

## 贡献者

感谢所有报告问题、参与评审或贡献代码的朋友。本仓库首轮社区评审记录在其已合并的 PR（#1–#3，2026-08-16）中。

## 许可证

[Apache License 2.0](LICENSE)

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
