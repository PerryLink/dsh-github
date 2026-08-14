# dsh-github 完善与提升方案

> **实施状态：✅ 已全部实施（v0.4.0，2026-08-14）。** 阶段 1-4 全部落地，包括阶段 4 的 `gh_search` 与模型化评审（`reviewMode: "model"`，经宿主 `subagents` 接缝）；仅 `dsh-github-action` 配套仓库 / npm 发布等需要外部账户的项保留为后续动作（见文末「阶段 4」）。验证：111 个测试通过、typecheck/build/check-readmes/pack 全绿。
>
> 研究基线：`dsh-github` v0.1.0（仓库 `PerryLink/dsh-github`，工作副本 `D:\deepseek-harness\Project\Plugins\dsh-github`）。
> 验证基线：77 个 vitest 用例全部通过；`git status` 干净；插件契约（注册即 effect、waterfall `next()`、模型可见⇔已记录、Schemastery 校验、`defineTool` 规范 JSON、纯函数 presenter、打包三通道）与官方 `dsh-plugin-guide` 及本地 harness checkout（`0.1.0-rc.5`）逐条核对无红线违规。
> 本文档按「问题清单 → 分阶段实施 → 验收」组织；每条问题附源码证据（`文件:行`，相对插件根目录）。

---

## 一、现状盘点（研究结论）

**架构**：单 bundle 插件，5 个工具（`pr_create` / `gh_review` / `review_post` / `gh_issue` / `issue_open`）、3 组命令（`/pr` `/review` `/issue`）、`tools/pre-execute` 审批门、凭据接缝逐操作解析 token、429 退避重试、确定性静态分析器（零 token）后台 review job。整体设计是干净的：命令处理器不写 GitHub（无 open turn，审批缝结构上对其关闭），写操作全部经模型工具走审批——这是对宿主机制的正确运用。

**亮点（应保留）**：
- 无自定义 Session 事件（外部插件事件不在 `KNOWN_SESSION_EVENT_TYPES`，会毁掉日志可读性）——判断正确且文档化。
- token 逐操作解析、不缓存、不进任何可见面——符合凭据接缝契约，且有专门安全测试。
- `applyWithDeps` + 注入式 runner（git/gh/fetch）——测试零网络零壳，设计优秀。
- 本地类型视图（`src/types.ts`）镜像宿主服务，与 checkout 中 `JobStart`/`JobHooks`/`kill`/`CommandDefinition.recordInput` 等签名逐一核对一致。

**主要短板**（详见第二节）：`gh_review` 静默吞错与 diff 可见性截断、issue 列表混入 PR、GHE 远程解析缺口、`review_post` 不可编辑、无行级 review 评论（README 自己承认的 v2 缺口）、工程化缺失（无 CI、死依赖、文档死链）。

---

## 二、问题清单（按优先级）

### P0 — 正确性与一致性（先修）

| # | 问题 | 证据 | 方案 |
|---|---|---|---|
| P0-1 | `RepoStateView` 接口重复声明两次（interface merging 掩盖了复制粘贴错误） | `src/state.ts:101-106` 与 `:119-124` | 删除其中一份。 |
| P0-2 | 模块 JSDoc 引用不存在的 README 小节 | `src/index.ts:16` 指向 “README.md ‘Session events and audit’”，README 无此标题 | 改为指向「Architecture → Model-visible ⇔ logged」或补上该小节。 |
| P0-3 | `maxDiffChars` 文档写 “Byte cap”，实现按 UTF-16 码元截断 | `src/config.ts:31`（注释）vs `src/tools.ts:60-62`（`text.length`/`slice`） | 统一为「字符数」口径（改注释/描述），不做字节级截断（diff 基本 ASCII，无实际收益）。 |
| P0-4 | `gh_review` 抓取最多 `maxDiffChars`（默认 8000）字符的 diff，但模型可见面（canonical `diff.excerpt` 与 render）硬编码只暴露 2000 字符——抓取的 75% 被浪费，且 2000 是硬编码可调参数（违反「无硬编码 tunable」精神） | `src/tools.ts:396`（`diffText.slice(0, 2000)`）、`:421`（render） | canonical 值完整返回截断后的 diff（`diff.text`），render 仍展示首段 + 截断说明；render 首段长度作为 Config 字段（如 `renderExcerptChars`，默认 2000）。 |
| P0-5 | `gh_review` 把「diff 抓取失败」与「截断」混为一个 `truncated` 位，且 comments/CI 抓取失败被静默吞掉——权限不足（如 token 无 `checks:read`）时模型看到的是「no checks reported」而非失败原因 | `src/tools.ts:341-369`（三处 `catch {}` 静默）、`:395-397`（`truncated: diffTruncated \|\| diffError`） | 三节各加结构化错误字段（`diff.error?` / `comments.error?` / `ci.error?`，值如 `'github-api-404'`/`'timeout'`），canonical schema 同步；结果保持部分成功语义。 |
| P0-6 | `gh_issue list` 把 PR 也列出来（GitHub `/issues` 端点含 PR） | `src/tools.ts:567`（无过滤）；REST 载荷中 PR 条目带 `pull_request` 键 | 过滤掉带 `pull_request` 的条目，或在 item 上标 `kind: 'issue' \| 'pr'`（推荐后者：不丢信息、模型可区分）。 |
| P0-7 | `repoFromRemoteUrl` 只认 `github.com`，但 `apiBaseUrl` 明确支持 GitHub Enterprise——GHE 用户每次调用都要手写 `ownerRepo` | `src/git.ts:45-48`、`src/config.ts:85-87` | 解析改为与配置的 API host 对齐：接受 `[任意主机][:/]owner/repo`（或至少校验解析出的主机 == `apiBaseUrl` 主机）；保持 `github.com` 默认行为不变。 |
| P0-8 | 429/403 等失败时，错误规范值丢弃 `GithubError` 已携带的 rate-limit 事实（读操作成功面有、失败面没有）；写操作结果完全没有 rate-limit | `src/tools.ts:52-57`（`githubErrorValue` 丢弃 `error.rateLimit`） | ERROR_SCHEMA 增加可选 `rateLimit`；`githubErrorValue` 透传；写工具成功值也附 `rateLimit`（与读面一致）。 |
| P0-9 | `/review stop <不存在id>` 时宿主 `jobs.kill` 抛 `unknown job`，命令处理器不捕获，用户看到原始异常文本 | `src/commands.ts:95`；宿主 `packages/jobs/jobs-local/src/index.ts:216`（`expect` 抛出） | 先查 `state.records`，未知 id 返回 `{kind:'error', text: ...}` 干净错误。 |
| P0-10 | `/review <pr>` 在未加载 `dsh-tool-jobs` 控制器时，`ctx.jobs.start` 直接抛出宿主内部错误（“no job controller serves this agent”），无指引 | `src/commands.ts:127`；宿主 `jobs-local/src/index.ts:131-134` | 捕获 `start` 异常，返回干净错误 + 指引（“load @deepseek-ai/dsh-tool-jobs”）。 |
| P0-11 | 审批理由对写操作仅展示标题，新增可编辑 body 后需展示内容预览（见 P1-2） | `src/approval-gate.ts:32-48` | `pr_create`/`issue_open`/`review_post` 的 ask reason 增加 body 长度/首行预览，让人类审批时知道将发布什么。 |

### P1 — 功能与体验（主线价值）

| # | 问题 | 证据 | 方案 |
|---|---|---|---|
| P1-1 | 行级 review 评论是 README 自认的最大 v2 缺口：`review_post` 只能发一条 issue 级聚合评论，分析器已算出 `file + line` 却用不上 | `src/review.ts:14-22`（Finding 带 line）、`src/tools.ts:481-483`（POST `/issues/{n}/comments`）；README.md:189 | ① 后台 job 在抓 diff 的同时抓 PR 元数据，记录 `head.sha`（`src/jobs.ts:84` 目前只抓 diff）；② `review_post` 增加 `mode: 'summary' \| 'inline'`（默认 `summary` 保持兼容）：`inline` 走 `POST /repos/{o}/{r}/pulls/{n}/reviews`（`event: 'COMMENT'`，`comments: [{path, line, body}]`），`line === null` 的 finding（如 `large-change`）并入 review body；③ 行号来自分析器的新文件行号，与 head commit 对齐。 |
| P1-2 | `review_post` 原样发布 job 草稿，模型不能在校准后修改评语 | `src/tools.ts:481-483`（`body: record.report.postBody` 无参数） | 增加可选 `body` 参数（空串拒绝）；审批 reason 展示 body 预览（联动 P0-11）。 |
| P1-3 | 后台 review job 只抓 diff，完成通知和 `job_output` 里没有 CI 状态与既有评论——模型被迫再跑一次 `gh_review` | `src/jobs.ts:84`（仅 diff 请求） | job 内一并抓取元数据 + check-runs + 评论（与 `gh_review` 同源归一），报告含 CI 摘要与评论数；仍确定性、零 token。 |
| P1-4 | issue 生命周期只有「读 + 建」：不能评论、不能关闭 | `src/tools.ts:493-602`（gh_issue 只读）、`:605-662`（issue_open 只建） | 新写工具 `issue_comment`（`POST /issues/{n}/comments`，参数 `ownerRepo`/`issueNumber`/`body`）与新写工具 `issue_close`（`PATCH /issues/{n}`，`state: 'closed'`，可选 `reason` 并入 body）；`allowedActions` 增加 `'issue.comment'`/`'issue.close'`，默认放行，均审批门控。 |
| P1-5 | 分析器密钥规则覆盖偏窄 | `src/review.ts:41` | 规则表补 `AIza[0-9A-Za-z_-]{35}`（Google API key）、`password\s*[:=]\s*['"]?[^\s'"]+`（弱提示）等常见形态；保持消息固定文本、绝不回显命中的密文（防二次泄露）。 |
| P1-6 | 评语 Markdown 注入面：文件名来自 diff（不可信仓库内容），直接插入 `### ${file}` | `src/review.ts:174` | 文件名与消息在 `formatPostBody` 内转义（反引号包裹 + 转义内部反引号/HTML 特殊字符），防止恶意 PR 文件名注入评语 Markdown。 |
| P1-7 | `/review` 无法透传 diff 上限/字段选择 | `src/commands.ts:119-139` | `/review <pr>` 支持可选参数（如 `/review o/r#7 --maxDiff 4000 --no-ci`），映射到 job 输入。 |

### P2 — 工程化、依赖与文档

| # | 问题 | 证据 | 方案 |
|---|---|---|---|
| P2-1 | `@deepseek-ai/dsh-scope` 在 peerDependencies 中但全仓零引用（死依赖，装进每个 profile 闭包） | `package.json:60`；grep `src/`+`test/` 无命中 | 删除该 peer；同时复核其余 peer：`dsh-session`/`dsh-llm` 仅类型使用但 `.d.ts` 引用，保留；`dsh-tools`/`dsh-credentials`/`cordis` 运行时必需，保留。 |
| P2-2 | 无 CI；`scripts/check-readmes.mjs` 未接入任何 script 或门禁 | `package.json:24-30`；仓库无 `.github/` | 新增 `.github/workflows/ci.yml`：pnpm install → typecheck → test → build → `pnpm pack` → check-readmes（含 5 语言 README 锚点互检）；`package.json` 增加 `check:readmes` script。 |
| P2-3 | README 安全措辞不准确：“Token lives only in the credential layer + Authorization header”——`env`/`gh` 来源时 token 实际来自进程环境/gh CLI | README.md:31、:83 | 改为准确表述：「逐操作读取，只写入 Authorization 头，绝不进入日志/事件/渲染/错误面」。 |
| P2-4 | 无 CHANGELOG；版本号 0.1.0 未随功能演进规划 | 仓库根 | 引入 CHANGELOG.md（keep-a-changelog 格式）；按本方案阶段发 0.2.0 / 0.3.0 / 0.4.0。 |
| P2-5 | README 徽章硬编码 “Tests: 77 passed”，每次加测试即过期 | README.md:20 | 改为不含数字的徽章，或接入 shields.io 动态测试徽章。 |
| P2-6 | `present.ts` 卡片 rawInput 风格不一致（`reviewPostCall` 用裸字符串，其他用对象） | `src/present.ts:86` | 统一为 `{ jobId: args.jobId }`。 |
| P2-7 | 无真实 API 冒烟测试（全部走 mock） | `test/`；README.md:204 | 新增 opt-in e2e：有 `GITHUB_TOKEN` 环境变量才跑（否则 self-skip，仿 harness e2e 政策），只对只读端点（`GET /rate_limit`、公开 PR 元数据）打真实 API。 |
| P2-8 | 提示注入面未文档化：PR 评论/issue 正文是外部不可信内容，进入模型上下文 | `src/tools.ts:390`（comments.body 进 canonical） | README「Security boundaries」补一段：外部内容被标注来源（render 前缀 `[from PR comment]`），并说明这是读网页式固有权衡。 |
| P2-9 | 进程内 `state.records` 无上限增长（长会话大量 review 不回收） | `src/state.ts:39,74`；README.md:190 承认 process-local | 增加 Config `maxReviewRecords`（默认 50），超限按 LRU 淘汰最旧已终态记录；已发布/killed 记录优先淘汰。 |

---

## 三、分阶段实施

### 阶段 1 — v0.2.0「正确性与工程化」（纯修复，无破坏性变更）
包含：P0-1 ~ P0-11、P1-5、P1-6、P2-1 ~ P2-6、P2-8。
- 每项改动用例先行/同行：P0-5/P0-8 改 canonical schema → 同步 `present.ts` 视图与 `tools.test.ts` 断言；P0-7 加 GHE 远程解析用例；P0-9/P0-10 补命令层错误路径用例（当前 `test/commands.test.ts` 无 unknown-job stop 用例）。
- `dsh-scope` 移除后 `pnpm install` 重算 lockfile。
- 5 语言 README 同步：新错误字段、安全措辞（P2-3）、injection 说明（P2-8）、配置表新增 `renderExcerptChars`/`maxReviewRecords`；`check:readmes` 过门禁。

### 阶段 2 — v0.3.0「评审深度」
包含：P1-1（行级评论）、P1-2（body 可编辑）、P1-3（job 报告富化）、P1-7（/review 参数）、P0-11（审批预览）。
- `ReviewJobRecord` 增加 `headSha`；`src/jobs.ts` 抓元数据 + diff；`review_post` schema 增 `mode`/`body`，`oneOf` 输出不变（`posted` 增 `mode`、`reviewId?`）。
- 测试：inline 模式请求体断言（`event: 'COMMENT'`、`comments[].line` 与 finding.line 一致、`line: null` 归入 body）；审批 reason 含预览断言。
- README 更新工具表、Known limitations（“One aggregated comment” 条目改写为「summary 默认 + inline 可选」）。

### 阶段 3 — v0.4.0「issue 生命周期」
包含：P1-4（`issue_comment` / `issue_close`）。
- `allowedActions` 类型与默认值扩展；审批门映射新工具；presenter + 测试 + 5 语言 README。

### 阶段 4 — v1.0 方向
- ✅ **模型化评审（已实施）**：`reviewMode: 'model'` + `modelReviewProvider` 配置；job 把截断 diff 交给宿主 `subagents` 接缝的一次性 subagent（parent = 发起 job 的 agent），子 agent 的 Markdown 输出成为可发布报告；接缝/provider 缺失响亮失败（start 期即检查）。
- ✅ **`gh_search` 工具（已实施）**：GitHub 搜索语法查询 issue/PR，独立搜索配额透传。
- ⏳ **`dsh-github-action` 配套仓库**：需你的 GitHub 账户，另行创建仓库。
- ✅ **发布 npm（已实施）**：裸名 `dsh-github` 已被 registry 上无关项目（`kaziii/dsh-github-connector`）占用，故以 `@perrylink/dsh-github` 作用域名发布（插件模块名不变）。
- ❌ **record 持久化（session 级）**：宿主 job 注册表本身进程级，单独持久化记录会误导；保留进程级 + `maxReviewRecords` 上限约束。

---

## 四、验收标准

1. `pnpm test`（含新增用例）全绿，`pnpm typecheck`、`pnpm build`、`pnpm pack`、`node scripts/check-readmes.mjs` 全绿。
2. 新增行为均有用例覆盖；P0 各项至少一条失败路径用例（静默吞错、unknown job、无控制器、GHE remote、PR 混入 list、错误面 rateLimit）。
3. 真实加载验证：`dsh --profile <name> --dump-config` 无 FAILED；`/review`、`gh_review`、`review_post --inline` 在 Web UI 走通一次（无 key 时至少 dump-config + 命令注册面验证）。
4. 5 语言 README 同步且锚点互检通过；CHANGELOG 记录每版本条目。
5. 安全测试保持并扩展：token 不出现在任何可见面（含新错误字段、审批预览、行级评论体）；P1-6 转义用例（恶意文件名）进入 `test/review.test.ts`。

## 五、明确不做（避免范围蔓延）

- 不引入自定义 Session 事件（宿主契约，见研究笔记）。
- 不改 agent-loop、不碰宿主仓库（`packages/`）；本仓库是独立插件包。
- 不做 `dsh-github-action` 配套仓库（需外部账户，后续动作）。
- 不做 GraphQL/搜索 API（阶段 4 方向）。
- 不把 token 加进任何 config 字段（凭据缝契约红线）。
