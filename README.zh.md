# dsh-github

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 GitHub 集成插件：创建 PR、用后台 job 审查 PR、读取 issue——**所有写操作都经人类审批**，token 永远不离开凭证层。

| | |
|---|---|
| 工具 | `pr_create` · `gh_review` · `gh_issue` · `review_post` · `issue_open` |
| 命令 | `/pr create [标题]` · `/review <pr>` · `/review stop <jobId>` · `/review post <jobId>` · `/issue open <标题>` |
| 宿主 | dsh `0.1.0-rc.6` web profile（任何基于 `dsh-base` 的 profile 均可用） |
| Peer 依赖 | `@deepseek-ai/cordis ^4.0.1` · `schemastery ^3.18.1` · `dsh-tools/dsh-llm/dsh-session/dsh-scope/dsh-credentials ^0.1.0-rc.5` |

[English](README.md)

## 一句话验收

装插件 + 配 token 之后，agent 可以**看 PR**（`gh_review`）、**后台审 PR**（`/review` + 复用自带 `job_list`/`job_output`/`job_kill` 工具）、**开 PR**（`/pr create` → 模型在审批下调用 `pr_create`）；人类用斜杠命令与审批面板控制，全部操作可审计，token 不泄露。

## 架构

```
                    ┌───────────────────────────────────────────────┐
                    │                   dsh-github                  │
                    │                                               │
 人类 ─── /pr ──────┼──► git 读取（只读）──► agent.followup         │
         /review ───┼──► ctx.jobs.start("github-review") ──► job    │
         /issue ────┼──► agent.followup                              │
                    │                                               │
 模型 ─── pr_create / gh_review / gh_issue / review_post /          │
           issue_open（defineTool，只返回规范 JSON）                 │
                    │                                               │
                    └───────┬───────────────┬───────────────┬───────┘
                            │               │               │
                  tools/pre-execute    凭证解析          GitHub REST
                  审批门（ask|deny）  （seam→env→       客户端（fetch、
                                    gh CLI，逐次解析） 429 重试、配额）
```

- **凭证接缝（F1/F2/S2）。** `tokenSource: auto` 每次操作按「credentials seam 引用（`GITHUB_TOKEN`）→ 环境变量 → `gh` CLI 登录态」顺序解析。token 值只是交给 REST 客户端的局部变量，绝不进入规范值、渲染文本、UI 卡片、命令输出、注入通知、job 输出、审批理由或错误消息。无 token 时所有工具返回结构化 `{ status: 'error', code: 'no-token', guidance }` 而不是崩溃。
- **审批（S1）。** 所有写操作都经模型工具。`tools/pre-execute` waterfall 监听器对 `pr_create`/`review_post`/`issue_open` 返回 `ask`，注册表即通过 `ctx.approval` 询问人类（宿主自动落 `approval/asked` + `approval/decided` 审计对），无应答者时 fail-closed；不在 `allowedActions` 白名单内的动作在询问前直接 deny。命令本身从不直接写：命令 handler 运行时没有开启的 turn，`ctx.approval.request` 对命令在结构上不可用——写命令先收集只读上下文，再唤醒 agent（空闲 `followup`、忙碌 `inject`），让模型在 turn 内调用受审批门保护的工具。
- **后台审查（F7/F8）。** `/review <pr>` 在 `ctx.jobs` 上启动 `github-review` job（带 label、owner、超时、可取消）。job 逐操作解析 token，拉取截断后的 diff，运行确定性的多文件静态分析器（`src/review.ts`：硬编码密钥、调试语句、eval、TODO 标记、超长行、超大改动）——不花 token、完全可测。完成通知由宿主的 `dsh-tool-jobs` 消费者送回发起会话；模型用自带 `job_output` 工具读取结论，用 `review_post` 发布——发布前必须审批。`/review stop <jobId>` 取消 job；job 本身绝不写 GitHub。
- **模型可见 ⟺ 已记录（N3）。** 本插件**不新增任何自定义会话事件类型**。仓库外插件的类型不在宿主 `KNOWN_SESSION_EVENT_TYPES` 中，未知的 required 事件会让宿主拒绝读取会话日志（宿主明确把外部插件事件注册面推迟到未来）。因此所有模型可见内容都走宿主已记录的表面：`tool/result` 规范值、经 `agent.inject`/`agent.followup` 的 `user/message` 通知、`command/run` + `command/done` 生命周期对、`approval/asked` + `approval/decided` 审计对。模型能看到的一切都能从会话日志重建。
- **纯 presenter（F5）。** `presentCall`/`presentResult` 是 `args`（+ 经 `presentationMeta` 持久化的 `result.meta`）的纯函数，实时流与日志回放行为一致。PR 创建结果以 generic 卡片展示 PR 链接。
- **429 与配额（S3）。** REST 客户端按 `Retry-After`/`x-ratelimit-reset` 以封顶指数退避重试 429（`maxRetries`、`retryBaseMs`、`retryMaxWaitMs`），每次读结果携带 `rateLimit: { remaining, resetAt }`，模型可见剩余配额。读工具并发安全，写工具不并发。

## 配置

加载期由 Schemastery 校验（非法即响亮失败）；默认值如下。可在 profile 的 `cordis.patch.yml` 覆盖任意键（整行 config 被替换，不深合并）。

| 键 | 默认值 | 含义 |
|---|---|---|
| `tokenSource` | `auto` | `auto`（credentials → env → gh）或指定 `credentials` / `env` / `gh` |
| `tokenRef` | `GITHUB_TOKEN` | credentials seam 引用名 / 环境变量名 |
| `defaultOwnerRepo` | — | 调用未指定且 git 无 origin 时的兜底 `owner/repo` |
| `autoCommit` | `false` | `/pr create` 是否允许指示模型先 commit+push（写操作仍走 bash 审批） |
| `maxDiffChars` | `8000` | 审查读取 PR diff 的上限 |
| `maxComments` | `20` | `gh_review` 列出 PR 评论的上限 |
| `reviewJobTimeoutMs` | `600000` | 单个后台审查 job 的截止时间（超时以 `timeout` 失败） |
| `maxRetries` | `3` | 单请求的 429 重试次数 |
| `retryBaseMs` | `500` | 重试退避基数（逐次翻倍） |
| `retryMaxWaitMs` | `60000` | 重试退避上限 |
| `apiBaseUrl` | `https://api.github.com` | GitHub REST 基地址（GitHub Enterprise） |
| `allowedActions` | `['pr.create','review.post','issue.create']` | 写动作白名单；名单外直接拒绝 |
| `workspaceDir` | 进程 cwd | 只读 git 检查的工作目录 |

## 工具

| 工具 | 类型 | 参数 | 返回 |
|---|---|---|---|
| `pr_create` | 写 | `title*`、`body?`、`base?`、`head?`、`draft?`、`ownerRepo?` | `{status:'created', url, number, title, state, draft, base, head}` 或结构化错误 |
| `gh_review` | 读 | `pr*`（数字 / `#n` / `o/r#n` / URL）、`fields?`、`maxDiffChars?` | 元数据、diff（截断 + 摘要 + 逐文件统计）、评论、CI、静态发现、配额 |
| `gh_issue` | 读 | `action*`（`list`/`get`/`comments`）、`ownerRepo?`、`issueNumber?`、`state?`、`limit?` | 归一化 issue 列表 + 配额 |
| `review_post` | 写 | `jobId*` | `{status:'posted', url, commentId, findings}` 或结构化错误 |
| `issue_open` | 写 | `title*`、`body?`、`labels?`、`ownerRepo?` | `{status:'created', url, number, title}` 或结构化错误 |

`execute` 只返回 `output.schema` 声明的规范 JSON；缺 token 与 GitHub API 失败是结构化错误分支，基础设施故障抛出（→ `isError`）。全程尊重 `exec.signal`。

## 命令

| 命令 | 效果 |
|---|---|
| `/pr create [标题]` | 读取 git 状态（分支、未提交变更、未推送提交、origin），为模型排队一条 `pr_create` 指令（描述草稿、默认值；除非 `autoCommit`，否则不 commit/push）。创建 PR 需审批。 |
| `/review <pr>` | 启动后台审查 job 并打印 job id；完成后宿主会通知，用 `job_output` 读取。 |
| `/review stop <jobId>` | 取消 job（本地控制，非 GitHub 写操作）。 |
| `/review post <jobId>` | 为模型排队 `review_post` 指令；发布需审批。 |
| `/issue open <标题>` | 为模型排队 `issue_open` 指令；创建需审批。 |

## 安装（三通道）

### 1. npm tarball（无需构建许可）

```sh
pnpm pack                          # 产出已含 lib/ 的 dsh-github-0.1.0.tgz
dsh plugin --profile <name> add ./dsh-github-0.1.0.tgz
```

### 2. git 源（需 `prepare` + `allowBuilds`）

```sh
dsh plugin --profile <name> add "github:owner/dsh-github#<sha>"
```

pnpm ≥10 默认拒绝运行 git 依赖的 `prepare`，首次 `add` 会失败；`dsh` 会提示确切包键，把它复制进 profile 的 `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  dsh-github: true
```

`prepare` 脚本（`scripts/prepare.mjs`）自包含：能找到 TypeScript 编译器就构建，否则回退到仓库内已提交的 `lib/` 产物，两者都没有才响亮失败。请钉住 commit；allowlist 构建等于信任该源码在安装时于你的机器上执行代码。

### 3. 本地 link（开发）

```sh
pnpm link --dir <本仓库>
dsh plugin --profile <name> add dsh-github
```

或直接在 profile 的 `cordis.patch.yml` 里加指向本仓库的 insert 行（tsx 源启动用 `src/index.ts` 绝对路径，或直接用构建产物 `lib/index.js`）。

**卸载：** `dsh plugin --profile <name> remove dsh-github`；若手动 insert 过，再删掉 `cordis.patch.yml` 里的对应行。

**验证：** `dsh --profile <name> --dump-config` 应在 `# == dsh-github` 段显示本插件行且无 `FAILED`；启动日志无 FAILED。

## 安全边界

- token 只存在于凭证解析结果与 REST 客户端的 Authorization 头中；从不落日志、不渲染、不注入、不进会话日志。
- 每次 GitHub 写操作（`pr_create`、`review_post`、`issue_open`）都需要 `ctx.approval` 的 `allowed-once`（默认策略 `ask`）；`rejected`、`cancelled`、`unavailable` 一律 fail-closed。
- `/pr create` 自己从不 commit/push；`autoCommit: true` 时模型通过 bash 工具（其自身审批门）执行这些写操作。dsh-github **不**管理 git 提交身份（那是 dsh-git-identity 的职责）、**不**做 worktree（那是 dsh-worktree 的职责）。
- 审查 job 零写操作：只读 diff、把报告存进进程内存；只有 `review_post` 在审批后发布。
- 配额：429 带退避重试，剩余配额对模型可见。

## 已知局限

- **无自定义会话事件。** 刻意为之：见「模型可见 ⟺ 已记录」。审计依赖宿主自有事件词汇（`tool/result`、`user/message`、`command/run`+`command/done`、`approval/asked`+`approval/decided`）。
- **静态分析器而非模型审查。** 审查 job 运行确定性的规则集（`src/review.ts`），零 token、可复现；经 subagent seam 接入模型审查是文档化的 v2 扩展点。
- **单条汇总评论。** `review_post` 以 PR 级 issue 评论发布整份报告，暂不做逐行 inline 评论（v2）。
- **job 与记录是进程内状态。** 审查报告按 job id 存于插件内存，与宿主 job 注册表同为进程级生命周期，插件重载/重启时一同消失。
- **npm `latest` 标签过期。** `@deepseek-ai/*` 公开包的 `latest` 停在旧版本；本插件用 `^0.1.0-rc.5` peer 范围对齐 profile 闭包（dsh-base 提供的版本），开发时钉 `0.1.0-rc.6`。不要裸跑 `npm i @deepseek-ai/dsh-tools`。
- **CI / GitHub Action**（`dsh-github-action`，对标 claude-code-action / codex-action 的 headless「审查 PR → 评论」闭环）是计划中的 v2 配套仓库；headless 下 `never` 审批策略会 fail-closed，Action 必须先组合应答器才能发布。

## 开发

```sh
pnpm install
pnpm test          # vitest：配置、凭证、429 重试、工具、命令、job、审批门、token 不泄露
pnpm typecheck
pnpm build         # tsc → lib/（noEmitOnError）
pnpm pack          # 可安装 tarball
```

测试通过注入的 runner mock 掉 GitHub API、`gh` CLI 与 git——不联网、不用真实凭证。`test/security.test.ts` 断言 token 字符串不出现在任何模型或人类可见输出中。

## 目录

```
src/index.ts          插件入口（name/inject/apply，applyWithDeps 供测试注入）
src/config.ts         Schemastery 配置
src/types.ts          宿主服务的最小结构视图 + Context 声明合并
src/credential.ts     token 解析（seam → env → gh），逐操作解析
src/github.ts         REST 客户端：429 重试、配额、diff 媒体类型
src/git.ts            只读 git 检查
src/review.ts         确定性 diff 分析器 + 评论草稿
src/jobs.ts           github-review 后台 job 生产者
src/approval-gate.ts  tools/pre-execute ask/deny 门
src/tools.ts          五个模型可调工具
src/commands.ts       /pr、/review、/issue
src/present.ts        纯 UI 卡片 presenter
test/                 vitest 套件 + mock 宿主脚手架
cordis.patch.yml      bundle patch（单行 insert）
scripts/prepare.mjs   git 安装用的自包含构建
```

## 许可证

MIT
