# dsh-github 完善与提升方案（v0.5.0）

> **实施状态：🔨 实施中（v0.5.0）。** 本文档在 v0.4.1 基线（111 个 vitest 用例全绿、npm `@perrylink/dsh-github@0.4.1` 已发布、仓库 PerryLink/dsh-github 已含 topics）上形成的第二轮完善方案。上一轮方案（v0.2.0–v0.4.1）已全部落地，见 CHANGELOG.md。
>
> 验证基线：`pnpm test` 111 passed / 2 skipped（e2e 需 `DSH_GITHUB_E2E_TOKEN`）；`git status` 干净；本地 harness checkout（`packages/jobs/jobs/src/types.ts`、`packages/subagent/subagent/src/types.ts`）与插件本地类型视图逐条核对：`JobStart`/`JobHooks`/`JobOutcome`/`JobSnapshot`、`SubagentStartRequest`/`SubagentRun`/`SubagentResult` 均未发生破坏性变化（subagent 仅新增可选 `agentOptions`/`outputSchema`/`maxDepth`/`toolFilter`/`persona` 能力，插件不依赖）。
>
> 本方案聚焦三类：**PR 生命周期补全**（合并/更新）、**仓库读取能力**（仓库元数据/文件读取）、**正确性与工程化加固**（二级限流重试、detached HEAD、硬编码可调参数、README 漂移门禁）。

---

## 一、现状盘点（第二轮研究结论）

**已具备（保持）**：8 个工具（5 写 3 读）、3 组命令、审批门 + `allowedActions`、逐操作 token 解析、429 退避重试、后台 review job（static/model 双引擎）、行级评论、GHE 支持、5 语言文档、CI、check-readmes 锚点门禁。

**本轮发现的短板**：

1. **PR 生命周期只到「创建」**：模型不能合并 PR，也不能改标题/目标分支——`pr_create` 之后的能力断档（证据：`src/tools.ts` 工具表无 merge/update；`src/config.ts:13` 动作表无 `pr.merge`/`pr.update`）。
2. **仓库读取只有 PR/issue 两个面**：读仓库元数据（默认分支、语言、license）或读任意文件内容（评审上下文、README、配置）都只能靠 bash/curl 绕道（证据：工具表无 repo/file 读取）。
3. **二级限流不重试**：GitHub 对 secondary rate limit / abuse detection 返回 **403 + Retry-After**（非 429）；当前客户端只重试 429，403 一律立刻失败（证据：`src/github.ts:178` 仅 `response.status !== 429` 才退出重试循环）。
4. **detached HEAD 会发出非法 PR**：`git rev-parse --abbrev-ref HEAD` 在游离态返回字面量 `HEAD`，`pr_create` 会把它当作 head 分支发给 API（证据：`src/tools.ts:197-202` 无分支名校验）。
5. **分析器硬编码可调参数**：`MAX_FINDINGS = 50`、`MAX_LINE_LENGTH = 300` 写死在 `src/review.ts:34,52`，违反「不得硬编码 tunable」（cordis.yml 改不了）。
6. **model review 的发布面措辞失真**：model 评审报告 `findings` 恒为 `[]`，`/review post` 通知与审批理由显示「0 finding(s)」（证据：`src/commands.ts:113-115`、`src/approval-gate.ts:59`）。
7. **README 漂移只能靠人眼**：`check-readmes.mjs` 只查锚点；工具表/配置表漏行、版本号过期（如 5 语言 README 里的 `dsh-github-0.4.0.tgz`）无机械门禁（证据：`scripts/check-readmes.mjs:31-44`；`README.md:62-63,101`）。
8. **`review_post` 卡片丢弃 body 覆盖**（rawInput 只有 jobId/mode，与其它卡片风格不一致；证据：`src/present.ts:99`）。

---

## 二、问题清单与方案

### A. 新工具（v0.5.0 主线）

| # | 工具 | 类型 | 方案 |
|---|---|---|---|
| A-1 | `pr_merge` | 写 | `PUT /repos/{o}/{r}/pulls/{n}/merge`；参数 `pr*`（复用 `parsePrRef`）、`mergeMethod?`（`merge`/`squash`/`rebase`，默认 `merge`）、`commitTitle?`、`commitMessage?`、`deleteBranch?`（默认 false，先 GET PR 元数据取 `head.ref`，合并成功后 best-effort `DELETE /git/refs/heads/{ref}`，失败仅记 `branchDeleteNote`）；新动作 `pr.merge` 入 `allowedActions` 默认值；审批理由含 PR、方法与删分支提示；返回 `{status:'merged', merged, sha, message, url, branchDeleted, rateLimit}` 或结构化错误（405 未可合并 → `github-api-405`）。 |
| A-2 | `pr_update` | 写 | `PATCH /repos/{o}/{r}/pulls/{n}`；参数 `pr*`、`title?`、`body?`、`state?`（`open`/`closed`）、`base?`，四者至少其一否则 `invalid-args`；新动作 `pr.update`；返回 `{status:'updated', url, number, title, state, base, rateLimit}`。 |
| A-3 | `gh_repo` | 读 | `GET /repos/{o}/{r}`；参数 `ownerRepo?`；并发安全；返回 `{repo, description, defaultBranch, visibility, stars, forks, openIssues, language, license, topics, url, updatedAt, rateLimit}`。 |
| A-4 | `gh_file` | 读 | `GET /repos/{o}/{r}/contents/{path}?ref=…`；参数 `ownerRepo?`、`path*`、`ref?`、`maxChars?`（默认新配置 `maxFileChars`=12000）；base64 解码，超限截断并置 `truncated`；目录（数组响应）→ 结构化错误 `is-directory`；并发安全；返回 `{repo, path, ref, size, truncated, content, sha, url, rateLimit}`。 |

### B. 正确性加固

| # | 问题 | 方案 |
|---|---|---|
| B-1 | 403+Retry-After 不重试（二级限流） | `GithubClient.request` 把「403 且带 `retry-after` 头」纳入重试（同样受 `maxRetries`/`retryMaxWaitMs`/signal 约束）；无 Retry-After 的 403（权限）立即失败；补 `test/github.test.ts` 用例（重试后成功 / 无头立即失败）。 |
| B-2 | detached HEAD 发非法 PR | `pr_create` 取到 `git.branch === 'HEAD'` 时返回 `{code:'no-head', guidance:…}`，不请求 API；补用例。 |
| B-3 | 分析器硬编码 tunable | 新配置 `maxFindings`（默认 50，min 1）、`maxLineLength`（默认 300，min 1）；`analyzeDiff(diff, maxChars, options?)` 增可选第三参，tools/jobs 传配置值，纯函数默认值不变（review.test.ts 兼容）。 |
| B-4 | model review 发布面措辞 | `/review post` 通知与审批理由：当 `report.findings` 为空且 `summary` 以 `model review` 开头时显示「model review」而非「0 finding(s)」；`review_post` 审批理由同步。 |
| B-5 | inline 空评论数组 | `review_post` inline 且无行级 finding 时省略 `comments` 键（body-only review），避免空数组边缘行为。 |

### C. 工程化、文档与门禁

| # | 问题 | 方案 |
|---|---|---|
| C-1 | README 漂移无机械门禁 | `check-readmes.mjs` 增加：① 从 `src/tools.ts` 解析全部工具名、从 `src/config.ts` 解析全部配置键，断言 5 语言 README 各提及一遍；② 断言 `package.json` 版本号出现在 5 语言 README（tarball 通道处）；③ 保留锚点互检。 |
| C-2 | tarball 通道版本号过期 | 5 语言 README 的 `dsh-github-0.4.0.tgz` 统一改为 `dsh-github-<version>.tgz`（`pnpm pack` 产出，不再随版本过期）；删除本地过期 `dsh-github-0.4.0.tgz` 产物。 |
| C-3 | 版本/变更记录 | `package.json` → 0.5.0；CHANGELOG 新增 `[0.5.0]` 段（Added/Changed/Fixed）；发布后打 tag `v0.5.0` 并在 GitHub 建 Release。 |
| C-4 | 5 语言文档同步 | 特性列表（12 工具）、配置表（+`maxFileChars`/`maxFindings`/`maxLineLength`、`allowedActions` 默认值）、工具表（+4 行）、架构图工具清单、安全边界（`gh_file` 外部内容标注）、安装通道、布局说明（“twelve model-facing tools”）、模块 JSDoc（`src/index.ts`、`src/tools.ts`）。 |
| C-5 | 仓库描述过时 | 通过 GitHub API 更新仓库 description 至覆盖合并/更新/文件读取的新特性面。 |
| C-6 | e2e 冒烟扩展 | `test/e2e.test.ts` 增加一条真实 API 用例：读取 `deepseek-ai/deepseek-harness` 仓库一个已知小文件（contents 端点，只读）；本地验证时以用户 token 实跑。 |
| C-7 | 卡片与测试面 | `reviewPostCall` rawInput 增 `bodyChars`；新增 4 工具的 `presentCall`/`presentResult`；`test/tools.test.ts`「registers all eight tools」→ twelve；security.test.ts 工具清单补 4 个新工具；approval-gate 补 `pr.merge`/`pr.update` 决策与理由用例；config.test.ts 补新键校验；新增 `test/present.test.ts` 覆盖新卡片纯函数。 |

---

## 三、分阶段实施

1. **基础设施**：config（新键/新动作）→ github（403 重试）→ review（tunable 选项）→ 测试先行补用例。
2. **新工具**：present.ts 类型与卡片 → tools.ts 四个新工具 + B-2/B-5 → approval-gate 映射 → index.ts 注册与文档。
3. **发布面**：commands 措辞（B-4）→ 测试全量（tools/security/approval-gate/config/present/github/e2e）→ `pnpm test`/`typecheck`/`build`/`pack`/`check:readmes` 全绿。
4. **文档**：5 语言 README + CHANGELOG + package.json 版本 + check-readmes 扩展（C-1/C-2）。
5. **交付**：本地以用户 token 跑 e2e → commit → tag `v0.5.0` → push → GitHub Release + 仓库描述 → `npm publish`（prepublishOnly 自带 build+test 门禁）→ 更新本文件状态。

## 四、验收标准

1. `pnpm test` 全绿（新增用例覆盖：403 重试、detached HEAD、pr_merge/pr_update/gh_repo/gh_file 各成功与失败路径、新配置校验、新审批动作、新卡片）；`pnpm typecheck`、`pnpm build`、`pnpm pack`、`pnpm run check:readmes` 全绿。
2. security.test.ts 扩展后 token 不泄漏断言覆盖 12 个工具的全部可见面。
3. e2e 以真实 token 实跑通过（只读端点）。
4. 5 语言 README 工具/配置清单与源码一致（check-readmes 机械断言）；CHANGELOG 完整。
5. GitHub：main 分支 + `v0.5.0` tag + Release 建成；npm：`@perrylink/dsh-github@0.5.0` 发布成功且 `latest` dist-tag 指向 0.5.0。

## 五、明确不做（避免范围蔓延）

- 不做 GraphQL、不做 Actions/Workflow 触发工具、不做 commit/分支写入工具（git 写入归 bash 审批门）。
- 不引入自定义 Session 事件（宿主契约）；不改 agent-loop、不碰宿主仓库。
- 不做 record 持久化（进程级与宿主 job 注册表一致，已有 `maxReviewRecords` 上限）。
- 不把 token 加进任何 config 字段（凭据缝契约红线）。
