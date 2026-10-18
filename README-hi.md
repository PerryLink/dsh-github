<div align="center">

# dsh-github

> Release stamp: `0.7.16` (2026-10-04).

> **पैकेज नाम।** यह प्रोजेक्ट npm पर **`@perrylink/dsh-github`** के रूप में प्रकाशित होता है। सादा नाम `dsh-github` किसी असंबंधित प्रोजेक्ट का है — उसे इंस्टॉल करने से यह प्लगइन इंस्टॉल नहीं होता।

**DeepSeek Harness के लिए GitHub के PR, समीक्षाएँ, issues और CI — हर write मानवीय approval से नियंत्रित, token कभी logged नहीं होता।**

*एजेंट से GitHub पर बनाएँ, समीक्षा करें, merge करें और खोजें — CI composite action, polling review bot और status-check gate के साथ।*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-github)
[![DSH plugin](https://img.shields.io/badge/dsh--plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-github.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-en.svg)](https://dsh.market/)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-github/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-github/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-github?label=version)](https://github.com/PerryLink/dsh-github/releases)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)
- **1024 स्टोर चैनल**: एक बार `npm i -g dsh1024`, फिर `dsh1024 plugin --profile web add @perrylink/dsh-github` ([deepseek1024.com](https://deepseek1024.com) इंस्टॉल रैंकिंग में गिना जाता है)।
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-github?metric=downloads&lang=hi)](https://dshfind.com/hi/plugins/PerryLink/dsh-github?ref=badge)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <name> add @perrylink/dsh-github
```


</div>

---

## What is dsh-github?

DeepSeek Harness के लिए GitHub के PR, समीक्षाएँ, issues और CI — हर write मानवीय approval से नियंत्रित, token कभी logged नहीं होता।

एजेंट से GitHub पर बनाएँ, समीक्षा करें, merge करें और खोजें — CI composite action, polling review bot और status-check gate के साथ।

![dsh-github का टर्मिनल डेमो: dsh-github — install, verify the row, check the repo](https://raw.githubusercontent.com/PerryLink/dsh-github/main/docs/assets/dsh-github-hero.png)

![Animated terminal demo of dsh-github](https://raw.githubusercontent.com/PerryLink/dsh-github/main/docs/assets/dsh-github-demo.gif)

*वही रन, एनिमेटेड।*

## 📚 विषय-सूची

- [What is dsh-github?](#what-is-dsh-github)
- [अनुकूलता](#अनुकूलता)
- [अन्य DSH प्लगइनों के साथ अंतर-संचालनीयता](#अन्य-dsh-प्लगइनों-के-साथ-अंतर-संचालनीयता)
- [आपको क्या मिलता है](#आपको-क्या-मिलता-है)
- [त्वरित शुरुआत](#त्वरित-शुरुआत)
- [स्थापना और अनइंस्टॉल](#स्थापना-और-अनइंस्टॉल)
- [कॉन्फ़िगरेशन](#कॉन्फ़िगरेशन)
- [टूल्स और सतहें](#टूल्स-और-सतहें)
- [आर्किटेक्चर](#आर्किटेक्चर)
- [अनुमतियाँ और डेटा](#अनुमतियाँ-और-डेटा)
- [सुरक्षा सीमाएँ](#सुरक्षा-सीमाएँ)
- [ज्ञात सीमाएँ](#ज्ञात-सीमाएँ)
- [विकास](#विकास)
- [रिपॉज़िटरी संरचना](#रिपॉज़िटरी-संरचना)
- [विषय](#विषय)
- [योगदानकर्ता](#योगदानकर्ता)
- [PerryLink DSH Plugin Family](#perrylink-dsh-plugin-family)
- [लाइसेंस](#लाइसेंस)

## अनुकूलता

| सतह | स्थिति |
|---|---|
| Harness | DeepSeek Harness `dsh-v0.2.1-alpha.1` (`>=0.1.2-rc.1 <0.2.0 \|\| >=0.1.5-alpha.1 <0.2.0 \|\| >=0.1.6-0 <0.2.0 \|\| >=0.1.7-0 <0.2.0` के लिए compat घोषित; 0.1.2-rc.1 2026-09-09 को अनुकूलित): review job अब नंगे `SessionId` का है और notice source plugin का अपना kind `dsh-github` है (host का `Agent \| SessionId` union और उसका catch-all `kind: 'plugin'` दोनों हट गए); settings card **Plugins पेज** (Official समूह, `plugins.item` slot) पर पंजीकृत होता है और `dsh-client-ui-plugin-manager` द्वारा दिए गए owner form से render होता है, हटाए गए `ctx.settingsScope` को bind करने की जगह; CI driver आधिकारिक `ctx.approval.setPolicy` नीति सीम से ऑटो-अनुमोदन करता है; review bot `ctx.jobs` पृष्ठभूमि job के रूप में टाइमर फ़ॉलबैक के साथ पोल करता है। 2026-09-24 को `0.1.7-rc.2` पर अपग्रेड (typecheck + typecheck:ci + 185 यूनिट टेस्ट हरे)। |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Platforms | सभी (host plugin; GitHub की ओर outbound network) |
| Model | कोई भी (static review deterministic है; `reviewMode: "model"` वैकल्पिक है) |

## आपको क्या मिलता है

`dsh-github` `dsh` और Claude Code व Codex जैसे टूल्स के बीच की GitHub कमी को पूरा करता है: आपका एजेंट pull requests पढ़, समीक्षा (review), खोल, update और merge कर सकता है, repository metadata और files पढ़ सकता है, issues पर comment और close कर सकता है, और खोज सकता है — जबकि हर write को एक मानव अनुमोदित (approve) करता है और token गुप्त रहता है।

- **14 टूल्स** — `pr_create`, `pr_merge`, `pr_update`, `gh_review`, `review_post`, `gh_issue`, `issue_open`, `issue_comment`, `issue_close`, `gh_search`, `gh_repo`, `gh_file`, `gh_repo_search`, `gh_checks`, सभी `defineTool` के ज़रिए canonical JSON।
- **3 कमांड परिवार** — `/pr create`, `/review` (start/stop/post), `/issue open`।
- **पूरा PR lifecycle** — बनाएँ → समीक्षा करें → update करें (title/body/state/base) → merge करें (merge/squash/rebase, वैकल्पिक head-branch deletion)।
- **Inline reviews** — `review_post` PR head commit के विरुद्ध एक summary comment या line-anchored review comments प्रकाशित करता है।
- **Approval-नियंत्रित writes** — हर GitHub write `ctx.approval` से होकर गुजरता है (डिफ़ॉल्ट `ask`, fail-closed); approval reasons titles, body sizes और comment overrides की पूर्व-झलक देते हैं।
- **Token गोपनीयता** — credentials seam → environment → `gh` CLI, प्रति operation resolved, कभी logs, events, renders या errors में नहीं।
- **Background review jobs** — `/review` `ctx.jobs` पर host के अपने `job_list` / `job_output` / `job_kill` surface के साथ चलता है।
- **लचीलापन** — `Retry-After`/`x-ratelimit-reset` backoff के साथ 429 retry; read tools concurrency-safe हैं; सभी calls cancellation का सम्मान करते हैं।
- **CI surface** — one-shot `ci_run` tool, एक polling review bot और एक status-check gate (composite action `action.yml`)।

## त्वरित शुरुआत

```sh
dsh plugin --profile web add github:PerryLink/dsh-github
```

```sh
# 1. bundle को अपने profile में इंस्टॉल करें
dsh plugin --profile web add github:PerryLink/dsh-github

# या npm से (प्रकाशित रिलीज़)
dsh plugin --profile web add @perrylink/dsh-github

# 2. पुनः आरंभ करें और row को सत्यापित करें
dsh --profile web --dump-config | grep -A3 'id: dsh-github'
```

## स्थापना और अनइंस्टॉल

- **git channel** (नवीनतम `main`): `dsh plugin --profile web add github:PerryLink/dsh-github` — `prepare` script केवल production dependencies के साथ build करता है।
- **npm channel** (प्रकाशित रिलीज़): `dsh plugin --profile web add @perrylink/dsh-github`।
- **tarball channel**: इस repo में `pnpm pack` चलाएँ, फिर `dsh plugin --profile web add ./perrylink-dsh-github-<version>.tgz`।
- **अनइंस्टॉल**: `dsh plugin --profile web remove @perrylink/dsh-github` (या profile patch से row हटाएँ)।

## कॉन्फ़िगरेशन

सभी tunables Schemastery `Config` fields हैं (cordis.yml से बदले जा सकते हैं)। एक id-लक्षित override पूरी row को बदल देता है — जो key आपको चाहिए उसे दोबारा लिखें। `cordis.patch.yml` हर key को inline दस्तावेज़ित करता है। GUI में, **Plugins पेज settings card** (Official समूह) `tokenRef` उस entry के अपने configuration form से पढ़ता है — `0.1.7-alpha.1` host ने `ctx.settingsScope` binding और उसके पीछे का namespace-registration seam हटा दिया, इसलिए कार्ड अब कोई settings namespace नहीं रखता। GitHub token configuration field नहीं है: कार्ड बताता है कि referenced credential सेट है या नहीं, और उसे credentials फ़ाइल के ज़रिए लिखता है — host half वहीं से resolve करता है।

| कुंजी | डिफ़ॉल्ट | अर्थ |
|---|---|---|
| `tokenSource` | `auto` | `auto` (credentials → env → gh) या `credentials` / `env` / `gh` में से कोई एक |
| `tokenRef` | `GITHUB_TOKEN` | Credential-seam reference / environment-variable नाम |
| `defaultOwnerRepo` | — | जब कोई call कोई नाम न दे और git के पास कोई origin न हो तो Fallback `owner/repo` |
| `autoCommit` | `false` | क्या `/pr create` model को पहले commit+push करने का निर्देश दे सकता है |
| `maxDiffChars` | `8000` | reviews में पढ़े जाने वाले PR diffs की character सीमा |
| `renderExcerptChars` | `2000` | tool output में render किए जाने वाले diff excerpt की character सीमा |
| `maxComments` | `20` | `gh_review` द्वारा सूचीबद्ध PR comments की सीमा |
| `reviewJobTimeoutMs` | `600000` | एक background review job की समय-सीमा (`timeout` के साथ fail होता है) |
| `maxReviewRecords` | `50` | in-memory review-job records की सीमा; सबसे पुराने settled records पहले evict होते हैं |
| `maxFileChars` | `12000` | `gh_file` द्वारा पढ़े गए file contents की character सीमा |
| `maxFindings` | `50` | प्रति review analyzer findings की सीमा |
| `maxLineLength` | `300` | line length जिसके पार analyzer long-line finding flag करता है |
| `reviewMode` | `static` | Review engine: `static` (deterministic analyzer) या `model` (host के `subagents` seam के ज़रिए one-shot subagent; seam अनुपस्थित होने पर fail loud) |
| `modelReviewProvider` | — | `reviewMode: "model"` के लिए subagent provider नाम; डिफ़ॉल्ट रूप से पहले registered provider का उपयोग |
| `maxRetries` | `3` | प्रति request 429 retry प्रयास |
| `retryBaseMs` | `500` | Retry backoff आधार (प्रति प्रयास दोगुना) |
| `retryMaxWaitMs` | `60000` | Retry backoff की अधिकतम सीमा |
| `requestTimeoutMs` | `30000` | प्रति request का hard timeout; exceed होने पर fetch abort |
| `apiBaseUrl` | `https://api.github.com` | GitHub REST base URL (GitHub Enterprise) |
| `allowedActions` | `['pr.create','pr.merge','pr.update','review.post','issue.create','issue.comment','issue.close','ci.run']` | Write-action whitelist; बाकी सब approval से पहले अस्वीकार |
| `workspaceDir` | process cwd | read-only git inspection के लिए working directory |
| `ci` | `{ enabled: false, … }` | CI integration section: polling review bot, status-check gate और one-shot `ci_run` tool (सभी `ci.*` keys इसी में हैं) |

## टूल्स और सतहें

| सतह | प्रकार | नोट्स |
|---|---|---|
| `pr_create` | tool | एक pull request बनाता है (write; approval-नियंत्रित) |
| `pr_merge` | tool | एक PR merge करता है (merge/squash/rebase, वैकल्पिक head-branch deletion) |
| `pr_update` | tool | एक PR update करता है (title/body/state/base) |
| `gh_review` | tool | एक PR पढ़ता है: metadata, capped diff, comments, CI, static findings |
| `review_post` | tool | एक review comment प्रकाशित करता है (summary या line-anchored inline) |
| `gh_issue` | tool | issues को list / get / comment करता है (PRs `kind: "pr"` marked) |
| `issue_open` | tool | एक issue बनाता है |
| `issue_comment` | tool | किसी issue या PR पर comment करता है |
| `issue_close` | tool | एक issue close करता है (वैकल्पिक state reason) |
| `gh_search` | tool | issues और PRs खोजता है (अलग search quota) |
| `gh_repo` | tool | repository metadata पढ़ता है |
| `gh_file` | tool | किसी branch/tag/commit पर एक file पढ़ता है |
| `gh_repo_search` | tool | GraphQL repository खोज (अलग search quota) |
| `gh_checks` | tool | GraphQL PR status checks (check runs + commit statuses) |
| `/pr create` | command | git स्थिति पढ़ता है और एक `pr_create` instruction queue करता है |
| `/review` | command | एक background review job start / stop / post करता है |
| `/issue open` | command | एक `issue_open` instruction queue करता है |
| `ci_run` | tool | composite action / CI driver द्वारा चलाई गई one-shot CI review |
| review bot | surface | idempotent inline comments वाला polling review bot (`ci.*`) |
| status-check gate | surface | PR head commit के हिसाब से `success` / `needs-changes` verdict प्रकाशित करता है (`action.yml`) |

## आर्किटेक्चर

- **Credential seam.** `tokenSource: auto` प्रति operation क्रम में resolve करता है: credentials seam (`GITHUB_TOKEN` reference) → environment variable → `gh` CLI token। यह मान एक local variable है जो REST client को दिया जाता है; यह कभी canonical values, renders, cards, command outputs, injected notices, job output, approval reasons या error messages में नहीं जाता।
- **Approval gate.** सभी writes model tools से होकर गुजरते हैं। एक `tools/pre-execute` waterfall listener write tools के लिए `ask` लौटाता है, इसलिए registry `ctx.approval` के ज़रिए मानव से पूछता है (host `approval/asked` + `approval/decided` audit pair log करता है) और बिना answerer के fail closed हो जाता है। Commands कभी सीधे write नहीं करते: एक write command read-only context इकट्ठा करता है, फिर एजेंट को जगाता है ताकि model gated tool को एक turn के भीतर चलाए।
- **Background review job.** `/review <pr>` `ctx.jobs` पर एक `github-review` job शुरू करता है; job metadata fetch करता है (inline posting के लिए head-commit SHA कैप्चर करते हुए), capped diff, CI checks और existing comments, फिर deterministic multi-file analyzer चलाता है (`src/review.ts`)। यह job कॉल करने वाले agent के नंगे `SessionId` का है — `0.1.7-alpha.1` registry को `SessionId` पर fence करता है, `Agent` union के बिना — इसलिए `dsh-tool-jobs` composed होना चाहिए, वरना `start` मना कर देगा। `reviewMode: "model"` होने पर, job capped diff को host के `subagents` seam के ज़रिए एक one-shot subagent को सौंपता है। Completion host के `dsh-tool-jobs` consumer के ज़रिए session तक पहुँचती है; model उसे `job_output` से पढ़ता है और `review_post` से प्रकाशित करता है।
- **CI composite action / review bot / status-check gate.** Repo में एक composite action (`action.yml`) शामिल है जो PRs की समीक्षा करती है, CI ठीक करती है और report लिखती है; एक polling review bot idempotent inline comments प्रकाशित करता है; और एक status-check gate PR head commit के हिसाब से verdict प्रकाशित करता है। One-shot `ci_run` tool headless run चलाता है। हर write approval-gated रहता है।

## अनुमतियाँ और डेटा

- **अनुमतियाँ**: writes official approval seam पर चलते हैं; कुछ भी re-implement या bypass नहीं किया जाता। Plugin अपने workshop manifest में `network:outbound` और `filesystem:write` घोषित करता है।
- **डेटा**: review report process memory में job id के आधार पर रहता है; disk पर कुछ भी durable नहीं लिखा जाता।
- **Session log**: plugin कोई custom session event types नहीं जोड़ता; सारा model-visible content host-logged surfaces से होकर बहता है (`tool/result`, `user/message`, `command/run`, `approval/asked`…)। Commands जो notices queue करते हैं वे plugin का अपना source kind ले जाते हैं, `{ kind: 'dsh-github', form: 'notice', summary }` — host में कोई catch-all `plugin` kind नहीं है, और उसका session-format admission path उसे सीधे अस्वीकार करता है।

## सुरक्षा सीमाएँ

- **Approval, enforcement नहीं।** Writes official seam पर केवल `ask`/deny decisions उत्पन्न करते हैं; sandbox और approval systems ही enforcement authorities रहते हैं।
- **Fail closed।** Approval answerer अनुपस्थित होने पर सबसे सख्त decision पर degrade होता है — कभी silent pass-through नहीं।
- **Token कभी process से बाहर नहीं जाता।** यह प्रति operation पढ़ा जाता है और केवल Authorization header में भेजा जाता है; कभी logged, rendered, injected या errors में नहीं आता।
- **Approval से बाहर कोई write नहीं।** `/pr create` कभी खुद commit या push नहीं करता; `autoCommit: true` के साथ model वे writes bash tool के अपने approval gate से करता है। Review job कोई write नहीं करता; केवल `review_post` approval के बाद प्रकाशित करता है।
- **Untrusted content escaped और marked होता है।** `formatPostBody` diff से लिए गए file names को backtick- और HTML-escape करता है, और external GitHub content (files, bodies, comments, search results) renders में external के रूप में marked होता है।
- **Bounded work और rate limits।** 429s को backoff के साथ retry किया जाता है; शेष quota हर result पर (failures सहित) दिखाया जाता है।

## ज्ञात सीमाएँ

- **कोई custom session events नहीं** — जानबूझकर (Architecture देखें); audit trails host के अपने event vocabulary पर निर्भर करते हैं।
- **Static analyzer by default** — deterministic rules (`src/review.ts`), शून्य tokens, reproducible। `reviewMode: "model"` tokens खर्च करता है और इसके लिए `subagents` seam व एक registered provider चाहिए।
- **Jobs और records process-local हैं** — review report plugin memory में job id के आधार पर रहता है; record map `maxReviewRecords` से capped है (सबसे पुराने settled records पहले evict होते हैं)।
- **npm `latest` dist-tags पुराने हैं** — `dsh-base` द्वारा दिए गए profile closure से install करें; कभी भी bare `npm i @deepseek-ai/dsh-tools` से न करें।

## विकास

```sh
pnpm install             # node ^22.19 || >=24
pnpm run build           # tsc --noEmitOnError → lib/
pnpm run prepare         # self-contained git-install build (scripts/prepare.mjs)
pnpm run prepublishOnly  # प्रकाशन से पहले build + test
pnpm test                # vitest run
pnpm run typecheck       # tsc --noEmit
pnpm run check:readmes   # सभी 5 READMEs में TOC anchors, tools और config keys की जाँच करता है
```

## रिपॉज़िटरी संरचना

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

## विषय

`dsh` · `dsh-plugin` · `deepseek-harness` · `github` · `pull-request` · `code-review` · `issue-tracker`

## योगदानकर्ता

- [@PerryLink](https://github.com/PerryLink) — निर्माता और maintainer: GitHub tool surface, approval gate, background review jobs, CI composite action, review bot, status-check gate और पाँच-भाषा docs।
- [@AraragiEro](https://github.com/AraragiEro) — Plugins settings पेज में GitHub token settings card (#6)।
- [@alexchenzl](https://github.com/alexchenzl) — DSH Directory पर plugin को सूचीबद्ध करने का निमंत्रण (#5)।

## अन्य DSH प्लगइनों के साथ अंतर-संचालनीयता

**DSH `0.2.0-rc.2`** (वह रनटाइम जिसके लिए यह README प्रकाशित है) और 2026-10-05 को सर्वे किए गए उच्च-स्टार प्लगइन सेट के विरुद्ध सत्यापित।

यह प्लगइन अन्य प्लगइनों में **हस्तक्षेप नहीं करता**, उन उच्च-स्टार प्लगइनों सहित जो व्यापक रूप से इंस्टॉल हैं:

- **कोई टूल-नाम टकराव नहीं।** सभी टूल नेमस्पेस युक्त हैं; कोई भी ऐसा नंगा नाम नहीं लेता जो पहले से किसी अंतर्निहित टूल या अन्य प्लगइन का हो।
- **कोई सर्विस-की टकराव नहीं।** यह कोई सर्विस key प्रदान नहीं करता, इसलिए टकराव संभव नहीं।
- **कोई स्लॉट टकराव नहीं।** यह कोई क्लाइंट slot key पंजीकृत नहीं करता, इसलिए `shadows-shipped-ui` सीट के लिए प्रतिस्पर्धा नहीं करता।
- **कोई HTTP रूट टकराव नहीं।** यह कोई `webServer` प्रीफ़िक्स पंजीकृत नहीं करता।
- **कोई patch-लेयर टकराव नहीं।** बंडल patch केवल अपनी पंक्ति `insert` करता है; कभी किसी अंतर्निहित पंक्ति का `config` ओवरराइड नहीं करता।
- **कोई वैश्विक परिवर्तन नहीं।** यह प्रोटोटाइप नहीं बदलता, `process.env` नहीं लिखता, और वैश्विक fetch dispatcher प्रतिस्थापित नहीं करता।

**साझा ईवेंट लिसनर रचना से ही अहस्तक्षेपी हैं।** यह क्रम-संवेदनशील ईवेंट `tools/pre-execute` को `ctx.on()` से देखता है — Cordis का **ब्रॉडकास्ट** पंजीकरण, जहाँ हर लिसनर चलता है और कोई किसी दूसरे को वंचित नहीं कर सकता। **यहाँ प्रत्येक लिसनर `next()` से डेलिगेट करता है**, इसलिए श्रृंखला कभी शॉर्ट-सर्किट नहीं होती:
  - `tools/pre-execute` — also used by `cc-safety-net` (1576★).

स्थैतिक प्रमाण: इस रिपॉज़िटरी पर `dsh-plugin-doctor` के K10–K13 सभी `pass` हैं।

## PerryLink DSH Plugin Family

यह प्रोजेक्ट [PerryLink](https://github.com/PerryLink) के **87 सक्रिय रूप से अनुरक्षित** DeepSeek Harness प्लगइन में से एक है। पूरा परिवार **95** प्लगइन है — **5 फ़्रोज़न**, **3 सेवानिवृत्त** — और नीचे संक्षिप्त रखा गया है ताकि हर README की पहली स्क्रीन छोटी रहे। हर पंक्ति देखने के लिए इसे खोलें; कारण स्थिति कॉलम में है।

<details>
<summary>सभी 95 प्लगइन खोलें</summary>

| प्लगइन | एक पंक्ति | स्थिति |
|---|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** | 水产养殖投入品记录核对（按投入品用量、休药期与起捕间隔核对记录自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** | 档案归档完整性与保管期限核对（依据《档案法》及配套规定，仅提示差异，不作出定性结论） |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command |  |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | 🚫 सेवानिवृत्त — रिपॉज़िटरी README देखें |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** | 投标文件符合性预检（按招标文件逐条核对响应情况，仅提示差异，不作出定性结论） |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** | 投标人资格条件核对（按资格条件与证明材料核对逐条响应，仅提示差异，不作出定性结论） |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | 🧊 फ़्रोज़न — रिपॉज़िटरी README देखें |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |  |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | 🧊 फ़्रोज़न — रिपॉज़िटरी README देखें |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** | 合同条款立场台账核对（按立场、风险等级与退让底线核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** | 报关单证一致性核对（按公开的报关单填制规范核对单证间字段一致性，仅提示差异，不作出定性结论） |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) |  |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | 🧊 फ़्रोज़न — रिपॉज़िटरी README देखें |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** | 滞箱费台账核对（按免箱期与费率核对超期天数与金额的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review |  |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | 🧊 फ़्रोज़न — रिपॉज़िटरी README देखें |
| **[dsh-drill-script-check](https://github.com/PerryLink/dsh-drill-script-check)** | 应急演练脚本核对（按阶段、响应分级、指挥与资源要素核对脚本齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-eia-guide-check](https://github.com/PerryLink/dsh-eia-guide-check)** | 环评导则适用性核对（按要素、导则名称与执行标准核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-emergency-plan](https://github.com/PerryLink/dsh-emergency-plan)** | 应急预案要素齐备性与条款级页码定位（依据 GB/T 29639-2020 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-essay-rubric-check](https://github.com/PerryLink/dsh-essay-rubric-check)** | 作文量表评分核对（按评分项、原文定位与分值算术核对评分自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-evidence-check](https://github.com/PerryLink/dsh-evidence-check)** | 证据清单齐备性核对（按待证事实与证据要素核对清单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-export-ctl-check](https://github.com/PerryLink/dsh-export-ctl-check)** | 出口管制物项核对（按管制清单、最终用途与许可证核对台账齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. |  |
| **[dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check)** | FMEA 分析表要素齐备性与风险顺序数一致性核对（按公开的 FMEA 方法标准核对表内自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-forecast-penalty](https://github.com/PerryLink/dsh-forecast-penalty)** | 预测准确率考核核对（按准确率、门槛与考核单价核对考核费用的算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds |  |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval |  |
| **[dsh-gongwen-flow-check](https://github.com/PerryLink/dsh-gongwen-flow-check)** | 公文流转与办理时限核对（按公开的公文处理规范核对环节完整性与时限，仅提示差异，不作出定性结论） |  |
| **[dsh-gongwen-word-check](https://github.com/PerryLink/dsh-gongwen-word-check)** | 公文格式要素核对（按公开的党政机关公文格式标准核对版头与主体要素，仅提示差异，不作出定性结论） |  |
| **[dsh-guard-plan-qc](https://github.com/PerryLink/dsh-guard-plan-qc)** | 劳动保护与安全防护用品配置表核对（按公开的配备标准核对品名规格与配置数量，仅提示差异，不作出定性结论） |  |
| **[dsh-hazchem-check](https://github.com/PerryLink/dsh-hazchem-check)** | 危险化学品临界量与重大危险源辨识核对（按储存量与临界量核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-hazplan-check](https://github.com/PerryLink/dsh-hazplan-check)** | HAZOP 分析表要素齐备性与偏差推导一致性核对（依据公开的危险与可操作性分析标准，仅提示差异，不作出定性结论） |  |
| **[dsh-hidden-risk-map](https://github.com/PerryLink/dsh-hidden-risk-map)** | 安全隐患台账→《工贸企业重大事故隐患判定标准》（应急管理部令第10号）条款映射提示（仅提示差异，不作出定性结论） |  |
| **[dsh-hs-classify](https://github.com/PerryLink/dsh-hs-classify)** | 商品归类层级一致性核对（按章、品目、子目与商品编号的层级关系核对自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-icd-rule-check](https://github.com/PerryLink/dsh-icd-rule-check)** | ICD 合并编码与星剑号配对提示（依据 GB/T 14396-2016 与公开的 ICD 使用说明，仅提示差异，不作出定性结论） |  |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` |  |
| **[dsh-lawcite-adapter](https://github.com/PerryLink/dsh-lawcite-adapter)** | 法条引用与文书要素核对（按名称、条号、原文与效力状态核对引用可核验性，仅提示差异，不作出定性结论） |  |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools |  |
| **[dsh-lc-doc-check](https://github.com/PerryLink/dsh-lc-doc-check)** | 信用证单据条款核对（按单据种类、份数、期限与不符点核对交单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-learning-gap-check](https://github.com/PerryLink/dsh-learning-gap-check)** | 能力差距与培养计划核对（按能力等级差、培养措施与完成期限核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. |  |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. |  |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers |  |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer |  |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors |  |
| **[dsh-medrec-qc](https://github.com/PerryLink/dsh-medrec-qc)** | 病案首页形式质控与逻辑矛盾提示（依据国卫办医发〔2016〕24号等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool |  |
| **[dsh-nsfc-form-check](https://github.com/PerryLink/dsh-nsfc-form-check)** | 国家自然科学基金申请书形式审查与匿名化提示（依据《国家自然科学基金条例》与申请人导入的当年指南，仅提示差异，不作出定性结论） |  |
| **[dsh-nurse-record-check](https://github.com/PerryLink/dsh-nurse-record-check)** | 护理记录时限、签名与评估表完整性校验（依据《病历书写基本规范》等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. |  |
| **[dsh-origin-rvc-check](https://github.com/PerryLink/dsh-origin-rvc-check)** | 原产地区域价值成分核对（按 RVC 定义式与门槛核对原产地判定自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-ota-review-check](https://github.com/PerryLink/dsh-ota-review-check)** | 在线点评回复台账核对（按回复时限、问题分类与整改状态核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching |  |
| **[dsh-paper-doc-adapter](https://github.com/PerryLink/dsh-paper-doc-adapter)** | 试卷解析结构核对（按题型、答案、分值与 yotta 标识核对试卷结构自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit |  |
| **[dsh-permit-report-check](https://github.com/PerryLink/dsh-permit-report-check)** | 行政许可办理核对（按申请材料、法定时限与决定记录核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-pipeline-check](https://github.com/PerryLink/dsh-pipeline-check)** | 项目全流程文件链条核对（按环节先后与金额口径核对链条自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-pleading-draft](https://github.com/PerryLink/dsh-pleading-draft)** | 起诉状要素齐备性核对（按诉请、事实、证据、法条四要素核对文书齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins |  |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill |  |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins |  |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card |  |
| **[dsh-policy-brief-draft](https://github.com/PerryLink/dsh-policy-brief-draft)** | 政策专报要素核对（按观点、依据、出处与建议核对专报齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-power-loss-split](https://github.com/PerryLink/dsh-power-loss-split)** | 线损电量拆分与考核表核对（依据公开的线损计算口径，仅提示差异，不作出定性结论） |  |
| **[dsh-power-ticket-check](https://github.com/PerryLink/dsh-power-ticket-check)** | 电力工作票要素齐备性与签发许可顺序核对（依据现行电力安全工作规程，仅提示差异，不作出定性结论） |  |
| **[dsh-ppap-check](https://github.com/PerryLink/dsh-ppap-check)** | PPAP 提交要素齐备性核对（按公开的 PPAP 手册与提交等级核对要素齐备与版本填写，仅提示差异，不作出定性结论） |  |
| **[dsh-protest-deadline](https://github.com/PerryLink/dsh-protest-deadline)** | 质疑与投诉期限核对（按公开的政府采购质疑投诉规定核对期限与台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-railway-window](https://github.com/PerryLink/dsh-railway-window)** | 铁路施工天窗台账核对（按时间窗、时长算术与命令号核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | 🧊 फ़्रोज़न — रिपॉज़िटरी README देखें |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** | 维修工单结算核对（按项目金额、配件工时合计与结算总额核对算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** | 审稿意见逐条回应覆盖核对（按意见与回应一一对应核对覆盖完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** | 规则库文件自检核对（按条款引用纪律与效力上限核对规则库自身合规，仅提示差异，不作出定性结论） |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** | 安全技术交底记录要素齐备性与签字闭环核对（依据公开的安全生产法规与检查标准，仅提示差异，不作出定性结论） |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. |  |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | 🚫 सेवानिवृत्त — रिपॉज़िटरी README देखें |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** | 监理日志跨日连续性与旁站覆盖提示（依据 GB/T 50319-2013 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** | 三重一大决策台账核对（按前置研究、会议审议与决议记录核对程序留痕，仅提示差异，不作出定性结论） |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** | 土壤与地下水监测台账核对（按点位、监测项目、限值与超标判定核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** | 作业规程与 FMEA／控制计划一致性核对（按编号与版本核对三份文件是否同步，仅提示差异，不作出定性结论） |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** | 控制图常数与过程能力指数核对（按 GB/T 4091 的常规控制图常数表核对控制限与 Cp/Cpk 的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. |  |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | 🚫 सेवानिवृत्त — रिपॉज़िटरी README देखें |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** | 招标文件条款摘录核对（按出处与原文逐字核对摘录完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** | 评标因素评分矩阵核对（按分值上限与合计核对矩阵自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** | 质保期与索赔金额核对（按质保期月数与里程、索赔金额算式核对自洽，仅提示差异，不作出定性结论） |  |

</details>

</details>

</details>

### DSH Desktop मार्केट से इंस्टॉल करें

सभी PerryLink प्लगइन DSH Desktop के बिल्ट-इन मार्केट में देखे जा सकते हैं: **Market → Sources → add source → पेस्ट करें** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ चुनें**। इंस्टॉलेशन मार्केट के npm-identity सत्यापन और आपकी पुष्टि से ही होता है।

## लाइसेंस

[Apache License 2.0](LICENSE) © 2026 dsh-github contributors
