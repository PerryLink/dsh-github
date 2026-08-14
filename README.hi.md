<h1 align="center">dsh-github</h1>

<p align="center">
  <b>GitHub को DeepSeek Harness में लाएँ।</b><br/>
  Pull request बनाएँ · inline या summary comments के साथ PR की समीक्षा करें · issues प्रबंधित करें · खोजें — हर write मानवीय approval से नियंत्रित, token कभी logged नहीं होता।
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt.md">Português</a> ·
  हिन्दी
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

**dsh-github** [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) के लिए एक bundle plugin है — जो "everything is a plugin" एजेंट harness है। यह dsh और [Claude Code](https://github.com/anthropics/claude-code) (`gh claude` / [claude-code-action](https://github.com/anthropics/claude-code-action)) तथा [Codex](https://github.com/openai/codex) (`@codex review` / Autofix CI) जैसे टूल्स के बीच की GitHub कमी को पूरा करता है: आपका एजेंट **PR पढ़ सकता है, PR की समीक्षा (review) कर सकता है, PR खोल सकता है, issues पर comment कर सकता है और उन्हें close कर सकता है, और खोज सकता है** — जबकि हर write को एक मानव अनुमोदित (approve) करता है और token गुप्त रहता है।

- 🛠 **8 टूल्स** — `pr_create` · `gh_review` · `review_post` · `gh_issue` · `issue_open` · `issue_comment` · `issue_close` · `gh_search`, सभी `defineTool` के ज़रिए canonical-JSON
- ⌨️ **3 कमांड परिवार** — `/pr create` · `/review` (start/stop/post) · `/issue open`
- 📝 **Inline reviews** — `review_post` एक summary comment या PR head commit के विरुद्ध line-anchored review comments प्रकाशित करता है
- 🔒 **Approval-नियंत्रित writes** — हर GitHub write `ctx.approval` से होकर गुजरता है (डिफ़ॉल्ट `ask`, fail-closed); approval reasons titles, body sizes, और comment overrides की पूर्व-झलक देते हैं
- 🗝 **Token गोपनीयता** — credentials seam → environment → `gh` CLI, प्रति operation resolved, कभी logs, events, renders, या errors में नहीं
- ⏱ **Background review jobs** — `/review` `ctx.jobs` पर host के अपने `job_list` / `job_output` / `job_kill` surface के साथ चलता है, और findings के साथ CI status और comment counts भी रिपोर्ट करता है
- 🤖 **Model review option** — `reviewMode: "model"` capped diff को host के `subagents` seam के ज़रिए एक one-shot subagent को सौंपता है; डिफ़ॉल्ट `static` mode deterministic और token-free रहता है
- 🚦 **429 backoff + quota surfacing** — model हर result पर (failures सहित) शेष rate limit देखता है; per-section fetch errors छिपाए जाने के बजाय दिखाए जाते हैं
- 🌐 **5-भाषा docs** — English · 中文 · Español · Português · हिन्दी

---

## 📚 विषय-सूची

- [त्वरित शुरुआत](#🚀-त्वरित-शुरुआत)
- [विशेषताएँ](#✨-विशेषताएँ)
- [स्थापना](#📦-स्थापना)
- [कॉन्फ़िगरेशन](#⚙️-कॉन्फ़िगरेशन)
- [टूल्स](#🛠-टूल्स)
- [कमांड](#⌨️-कमांड)
- [आर्किटेक्चर](#🏗-आर्किटेक्चर)
- [सुरक्षा सीमाएँ](#🔒-सुरक्षा-सीमाएँ)
- [ज्ञात सीमाएँ](#⚠️-ज्ञात-सीमाएँ)
- [विकास](#🧪-विकास)
- [रिपॉज़िटरी संरचना](#🗂-रिपॉज़िटरी-संरचना)
- [विषय](#🏷-विषय)
- [लाइसेंस](#लाइसेंस)

## 🚀 त्वरित शुरुआत

```sh
# 1. install (npm registry — सबसे सरल; या नीचे दिया गया tarball channel इस्तेमाल करें)
dsh plugin --profile <name> add @perrylink/dsh-github
#    tarball channel (registry की ज़रूरत नहीं):
pnpm pack                              # inside this repo → dsh-github-0.4.0.tgz
dsh plugin --profile <name> add ./dsh-github-0.4.0.tgz

# 2. configure a GitHub token (recommended: the credentials seam)
#    $DSH_HOME/.credentials.yaml
#    GITHUB_TOKEN: <your token>

# 3. use it — in the dsh web UI or headless
#    /pr create "add dark mode"      → agent drafts & opens the PR (approval required)
#    /review 42                      → background review job, read it with job_output
#    /review post github-review-1    → publish the review comment (approval required)
#    /issue open "crash on startup"  → agent opens the issue (approval required)
```

सत्यापन: `dsh --profile <name> --dump-config` में `# == dsh-github` सेक्शन **बिना किसी FAILED लाइन के** दिखना चाहिए।

## ✨ विशेषताएँ

| क्षेत्र | आपको क्या मिलता है |
|---|---|
| **PR बनाएँ** | `/pr create [title]` git स्थिति (branch, changed files, commits ahead) पढ़ता है और एजेंट को एक draft देता है; `pr_create` PR खोलता है और उसका URL लौटाता है |
| **PR की समीक्षा करें** | `gh_review` metadata, capped diff (canonical value में पूरा text, render में bounded excerpt), comments, CI status, और static findings का सारांश देता है — per-section fetch failures `diff.error` / `comments.error` / `ci.error` के रूप में रिपोर्ट होते हैं |
| **समीक्षाएँ पोस्ट करें** | `review_post` एक aggregated issue-level comment (`mode: "summary"`, डिफ़ॉल्ट) या PR head commit पर line-anchored review comments (`mode: "inline"`) प्रकाशित करता है; एक `body` override model को पहले comment को निखारने देता है — मानवीय approval के बाद |
| **Background reviews** | `/review <pr>` एक `ctx.jobs` job में metadata, capped diff, CI checks, और existing comments fetch करता है; completion output findings summary, CI status, और comment count लेकर आता है; `reviewMode: "model"` static analyzer के बजाय diff को एक one-shot subagent को सौंपता है |
| **Issues पढ़ें** | `gh_issue` lists / gets / comments करता है; listings में pull requests `kind: "pr"` के रूप में marked होते हैं |
| **Issues प्रबंधित करें** | `issue_open` बनाता है, `issue_comment` comment करता है (PRs पर भी काम करता है), `issue_close` एक optional state reason के साथ close करता है — सभी approval-नियंत्रित |
| **खोजें** | `gh_search` GitHub search syntax से issues और pull requests को query करता है, अलग search quota दिखाता है |
| **Approval** | `tools/pre-execute` हर write के लिए `ctx.approval` पूछता है; `allowedActions` whitelist prompting से पहले ही अस्वीकार कर देता है |
| **गोपनीयता सुरक्षा** | Token प्रति operation पढ़ा जाता है और केवल Authorization header में भेजा जाता है; एक समर्पित test पुष्टि करता है कि यह किसी भी दृश्य output में कभी नहीं आता |
| **लचीलापन** | `Retry-After`/`x-ratelimit-reset` backoff के साथ 429 retry; read tools concurrency-safe हैं; सभी calls cancellation का सम्मान करते हैं |
| **अवलोकन-क्षमता** | Model-visible ⇔ logged: model जो कुछ देखता है वह सब host के अपने session events (`tool/result`, `user/message`, `command/run`, `approval/asked`…) से होकर गुजरता है |

## 📦 स्थापना

चार दस्तावेज़ित channels — कोई एक चुनें।

| चैनल | कमांड | नोट्स |
|---|---|---|
| **npm registry** | `dsh plugin --profile <name> add @perrylink/dsh-github` | npm पर प्रकाशित — सबसे सरल channel |
| **npm tarball** | `dsh plugin --profile <name> add ./dsh-github-0.4.0.tgz` | built `lib/` के साथ आता है — कोई build permission आवश्यक नहीं |
| **git source** | `dsh plugin --profile <name> add "github:PerryLink/dsh-github#<sha>"` | `prepare` + `allowBuilds` चाहिए (नीचे देखें); commit को pin करें |
| **local link** | `pnpm link --dir .` then `dsh plugin add @perrylink/dsh-github` | विकास |

> npm package `@perrylink` scope के अंतर्गत प्रकाशित है क्योंकि unscoped `dsh-github` नाम registry पर किसी असंबंधित project के पास है। Plugin का module नाम `dsh-github` ही रहता है।

Git इंस्टॉल: pnpm ≥10 किसी git dependency के `prepare` को तब तक अस्वीकार करता है जब तक allowlisted न हो — `dsh` सटीक key प्रिंट करता है; उसे profile के `pnpm-workspace.yaml` में कॉपी करें:

```yaml
allowBuilds:
  '@perrylink/dsh-github': true
```

`prepare` script (`scripts/prepare.mjs`) स्व-निहित (self-contained) है: जब कोई compiler उपलब्ध हो तो यह TypeScript से build करता है, अन्यथा **committed `lib/` artifacts** पर fallback करता है, और दोनों के अभाव में loud रूप से fail होता है।

**अनइंस्टॉल:** `dsh plugin --profile <name> remove @perrylink/dsh-github`।

## ⚙️ कॉन्फ़िगरेशन

Load time पर Schemastery-सत्यापित (fail loud)। Profile के `cordis.patch.yml` में कोई भी key override करें (पूरी row config बदल दी जाती है, कभी deep-merged नहीं होती)।

| कुंजी | डिफ़ॉल्ट | अर्थ |
|---|---|---|
| `tokenSource` | `auto` | `auto` (credentials → env → gh) या `credentials` / `env` / `gh` में से कोई एक |
| `tokenRef` | `GITHUB_TOKEN` | Credential-seam reference / environment-variable नाम |
| `defaultOwnerRepo` | — | जब कोई call `owner/repo` नाम न दे और git के पास कोई origin न हो तो Fallback `owner/repo` |
| `autoCommit` | `false` | क्या `/pr create` model को पहले commit+push करने का निर्देश दे सकता है |
| `maxDiffChars` | `8000` | reviews में पढ़े जाने वाले PR diffs की character सीमा (cap) |
| `renderExcerptChars` | `2000` | tool output में render किए जाने वाले diff excerpt की character सीमा |
| `maxComments` | `20` | `gh_review` द्वारा सूचीबद्ध PR comments की सीमा |
| `reviewJobTimeoutMs` | `600000` | एक background review job की समय-सीमा (`timeout` के साथ fail होता है) |
| `maxReviewRecords` | `50` | in-memory review-job records की सीमा; सबसे पुराने settled records पहले evict होते हैं |
| `reviewMode` | `static` | Review engine: `static` (deterministic analyzer) या `model` (host के `subagents` seam के ज़रिए one-shot subagent; seam अनुपस्थित होने पर fail loud) |
| `modelReviewProvider` | — | `reviewMode: "model"` के लिए subagent provider नाम; डिफ़ॉल्ट रूप से पहले registered provider का उपयोग |
| `maxRetries` | `3` | प्रति request 429 retry प्रयास |
| `retryBaseMs` | `500` | Retry backoff आधार (प्रति प्रयास दोगुना) |
| `retryMaxWaitMs` | `60000` | Retry backoff की अधिकतम सीमा |
| `apiBaseUrl` | `https://api.github.com` | GitHub REST base URL (GitHub Enterprise) |
| `allowedActions` | `['pr.create','review.post','issue.create','issue.comment','issue.close']` | Write-action whitelist; बाकी सब approval से पहले अस्वीकार |
| `workspaceDir` | process cwd | read-only git inspection के लिए working directory |

## 🛠 टूल्स

| टूल | प्रकार | पैरामीटर | लौटाता है |
|---|---|---|---|
| `pr_create` | write | `title*`, `body?`, `base?`, `head?`, `draft?`, `ownerRepo?` | `{status:'created', url, number, title, state, draft, base, head, rateLimit}` या structured error |
| `gh_review` | read | `pr*` (number / `#n` / `o/r#n` / URL), `fields?`, `maxDiffChars?` | metadata, capped diff (पूरा `diff.text` + bounded `diff.excerpt` + per-file stats), comments, CI, static findings, per-section `error` fields, rate limit |
| `gh_issue` | read | `action*` (`list`/`get`/`comments`), `ownerRepo?`, `issueNumber?`, `state?`, `limit?` | normalized items (हर एक `kind: issue/pr/comment` marked) + rate limit |
| `review_post` | write | `jobId*`, `mode?` (`summary`/`inline`), `body?` | `{status:'posted', mode, url, commentId?, reviewId?, findings, rateLimit}` या structured error |
| `issue_open` | write | `title*`, `body?`, `labels?`, `ownerRepo?` | `{status:'created', url, number, title, rateLimit}` या structured error |
| `issue_comment` | write | `issueNumber*`, `body*`, `ownerRepo?` | `{status:'commented', url, commentId, issueNumber, rateLimit}` या structured error |
| `issue_close` | write | `issueNumber*`, `ownerRepo?`, `stateReason?` (`completed`/`not_planned`) | `{status:'closed', url, number, title, rateLimit}` या structured error |
| `gh_search` | read | `q*`, `sort?`, `order?`, `perPage?` | `{query, total, items[{number,title,state,kind,author,url,repo,comments,createdAt}], rateLimit}` या structured error |

`execute` केवल `output.schema` द्वारा घोषित canonical JSON लौटाता है। Missing-token और GitHub-API failures structured error variants हैं जो rate-limit facts रखते हैं; infrastructure failures throw करते हैं (→ `isError`)। `exec.signal` का हर जगह सम्मान किया जाता है।

## ⌨️ कमांड

| कमांड | प्रभाव |
|---|---|
| `/pr create [title]` | git स्थिति पढ़ता है और model के लिए एक `pr_create` instruction queue करता है (draft body, defaults, `autoCommit` न हो तो कोई commit/push नहीं)। PR बनाने पर approval माँगा जाता है। |
| `/review <pr>` | एक background review job शुरू करता है; job id प्रिंट करता है। पूर्णता की घोषणा host करता है; उसे `job_output` से पढ़ें। |
| `/review <pr> --max-diff <n> --no-ci --no-comments` | Per-job overrides: diff cap और job कौन-से supplementary sections fetch करता है। |
| `/review stop <jobId>` | job रद्द करता है (local control, कोई GitHub write नहीं)। |
| `/review post <jobId>` | model के लिए एक `review_post` instruction queue करता है (summary या inline); पोस्ट करने पर approval माँगा जाता है। |
| `/issue open <title>` | model के लिए एक `issue_open` instruction queue करता है; बनाने पर approval माँगा जाता है। |

## 🏗 आर्किटेक्चर

```
                    ┌───────────────────────────────────────────────┐
                    │                   dsh-github                  │
                    │                                               │
 मानव ─── /pr ────┼──► git reader (read-only) ──► agent.followup  │
         /review ───┼──► ctx.jobs.start("github-review") ──► job    │
         /issue ────┼──► agent.followup                              │
                    │                                               │
 मॉडल ─── pr_create / gh_review / gh_issue / review_post /         │
           issue_open / issue_comment / issue_close / gh_search     │
           (defineTool, canonical JSON only)                        │
                    │                                               │
                    └───────┬───────────────┬───────────────┬───────┘
                            │               │               │
                  tools/pre-execute     credential        GitHub REST
                  approval gate        resolution        client (fetch,
                  (ask | deny)      (seam → env →       429 retry,
                                    gh CLI, per-op)     rate-limit)
```

- **Credential seam.** `tokenSource: auto` प्रति operation क्रम में resolve करता है: credentials seam (`GITHUB_TOKEN` reference) → environment variable → `gh` CLI token। यह मान एक local variable है जो REST client को दिया जाता है; यह कभी canonical values, renders, cards, command outputs, injected notices, job output, approval reasons, या error messages में नहीं जाता।
- **Approval.** सभी writes model tools से होकर गुजरते हैं। एक `tools/pre-execute` waterfall listener पाँच write tools के लिए `ask` लौटाता है, इसलिए registry `ctx.approval` के ज़रिए मानव से पूछता है (host `approval/asked` + `approval/decided` audit pair log करता है) और बिना answerer के fail closed हो जाता है। Approval reasons यह पूर्व-झलक देते हैं कि क्या प्रकाशित होगा (titles, body sizes, और overridden review body की पहली line)। Commands कभी सीधे write नहीं करते: command handlers बिना किसी open turn के चलते हैं, इसलिए approval seam उनके लिए संरचनात्मक रूप से बंद है — एक write command read-only context इकट्ठा करता है, फिर एजेंट को जगाता है (idle होने पर `followup`, busy होने पर `inject`) ताकि model gated tool को एक turn के भीतर चलाए।
- **Background review.** `/review <pr>` `ctx.jobs` पर एक `github-review` job शुरू करता है (label, owner, timeout, cancelable)। Job प्रति operation token resolve करता है, PR metadata fetch करता है (inline posting के लिए head-commit SHA कैप्चर करते हुए), capped diff, और — जब तक disabled न हो — CI check runs और existing review comments, फिर एक deterministic multi-file analyzer चलाता है (`src/review.ts`: hardcoded secrets, Google API keys, credential assignments, debug artifacts, eval, TODO markers, long lines, oversized changes) — शून्य tokens खर्च, पूर्णतः testable। `reviewMode: "model"` होने पर, job इसके बजाय capped diff को host के `subagents` seam के ज़रिए एक one-shot subagent को सौंपता है (owning agent parent होता है) और child के Markdown output को postable report के रूप में store करता है; seam या provider अनुपस्थित होने पर fail loud होता है। Supplementary fetch failures output में नोट किए जाते हैं बिना job को fail किए। Completion notices शुरू करने वाले session तक host के `dsh-tool-jobs` consumer के ज़रिए पहुँचते हैं; model रिपोर्ट को मौजूदा `job_output` tool से पढ़ता है और उसे `review_post` से प्रकाशित करता है — approval आवश्यक।
- **Model-visible ⇔ logged.** Plugin **कोई custom session event types नहीं** जोड़ता। Out-of-repo event types host के `KNOWN_SESSION_EVENT_TYPES` में नहीं हैं, इसलिए एक unknown required event plugin हटाने के बाद session log को अपठनीय बना देता (host जानबूझकर external plugins के लिए registration surface को defer करता है)। इसलिए सारा model-visible content host-logged surfaces से होकर बहता है: `tool/result` canonical values, `agent.inject`/`agent.followup` के ज़रिए `user/message` notices, `command/run` + `command/done` lifecycle pair, और `approval/asked` + `approval/decided` audit pair।
- **Pure presenters.** `presentCall`/`presentResult` `args` (+ persisted `result.meta`) के pure functions हैं, जो live streaming और log replay पर समान रहते हैं। PR creation PR URL के साथ एक generic card दिखाता है।

## 🔒 सुरक्षा सीमाएँ

- Token प्रति operation configured source (credentials seam, environment, या `gh` CLI) से पढ़ा जाता है और केवल REST client के Authorization header में भेजा जाता है। यह कभी logged, कभी rendered, कभी injected, कभी session log में appended, और कभी error messages में नहीं आता।
- हर GitHub write के लिए `ctx.approval` से `allowed-once` आवश्यक है (default policy `ask`); `rejected`, `cancelled`, और `unavailable` सभी fail closed होते हैं।
- `/pr create` कभी खुद commit या push नहीं करता; `autoCommit: true` के साथ model वे writes bash tool के अपने approval gate से करता है। dsh-github git identity (dsh-git-identity का काम) या worktrees (dsh-worktree का काम) का प्रबंधन **नहीं** करता।
- Review job कोई write नहीं करता: यह एक diff पढ़ता है और रिपोर्ट को process memory में रखता है; केवल `review_post` approval के बाद प्रकाशित करता है।
- Posted comments diff से लिए गए file names को interpolate करते हैं, जो untrusted repository content हैं: `formatPostBody` file names को backtick-escape और HTML-escape करता है ताकि कोई hostile PR review comment में Markdown inject न कर सके।
- GitHub से पढ़े गए issue/PR bodies, comments, और search results external untrusted content हैं जो model context में प्रवेश करते हैं — web fetching जैसा ही inherent tradeoff; plugin उन्हें अपने renders में external content के रूप में mark करता है।
- Rate limits: 429s को backoff के साथ retry किया जाता है और शेष quota हर result पर (failures सहित) model को दिखाया जाता है।

## ⚠️ ज्ञात सीमाएँ

- **कोई custom session events नहीं** — जानबूझकर (Architecture देखें); audit trails host के अपने event vocabulary पर निर्भर करते हैं।
- **Static analyzer by default** — deterministic rules (`src/review.ts`), शून्य tokens, reproducible। `reviewMode: "model"` LLM review के लिए capped diff को host के `subagents` seam के ज़रिए एक one-shot subagent को सौंपता है (tokens खर्च होते हैं; seam और एक registered provider की आवश्यकता होती है)।
- **Jobs और records process-local हैं** — review report plugin memory में job id के आधार पर रहता है, जो host job registry के lifetime से मेल खाता है; record map `maxReviewRecords` से capped है (सबसे पुराने settled records पहले evict होते हैं)।
- **npm `latest` dist-tags पुराने हैं** — plugin `^0.1.0-rc.5` peer ranges घोषित करता है ताकि यह `dsh-base` द्वारा दिए गए profile closure के विरुद्ध resolve हो, और विकास के लिए `0.1.0-rc.6` pin करता है। कभी भी bare `npm i @deepseek-ai/dsh-tools` से install न करें।
- **CI / GitHub Action** (`dsh-github-action`, claude-code-action / codex-action की भावना में headless review→comment loop) एक नियोजित v2 companion repository है।

## 🧪 विकास

```sh
pnpm install
pnpm test          # vitest: config, credentials, 429/retry, tools, commands, jobs, approval gate, token non-leakage
pnpm typecheck
pnpm build         # tsc → lib/ (noEmitOnError)
pnpm pack          # installable tarball
pnpm run check:readmes   # cross-checks TOC anchors in all 5 READMEs
```

Tests injected runners के ज़रिए GitHub API, `gh` CLI, और git को mock करते हैं — कोई network नहीं, कोई real credentials नहीं। `test/security.test.ts` पुष्टि करता है कि token string किसी भी model- या human-visible output में कभी नहीं आता। `test/e2e.test.ts` में opt-in real-API smoke tests हैं जो `DSH_GITHUB_E2E_TOKEN` सेट न होने पर खुद को skip कर लेते हैं (केवल read-only endpoints)।

## 🗂 रिपॉज़िटरी संरचना

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
src/tools.ts          the eight model-facing tools
src/commands.ts       /pr, /review, /issue
src/present.ts        pure UI-card presenters
test/                 vitest suite + mock host scaffolding + opt-in e2e smoke
cordis.patch.yml      bundle patch (one insert row)
scripts/prepare.mjs   self-contained git-install build
```

## 🏷 विषय

अनुशंसित GitHub repository topics (उन्हें repo settings में सेट करें — वे [`dsh-plugin` topic page](https://github.com/topics/dsh-plugin) और DSH plugin marketplaces को शक्ति देते हैं):

`dsh` · `dsh-plugin` · `deepseek-harness` · `github` · `pull-request` · `code-review` · `issue-tracker`

## लाइसेंस

[Apache License 2.0](LICENSE)
