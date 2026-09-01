<div align="center">

# dsh-github

**DeepSeek Harness के लिए GitHub के PR, समीक्षाएँ, issues और CI — हर write मानवीय approval से नियंत्रित, token कभी logged नहीं होता।**

*एजेंट से GitHub पर बनाएँ, समीक्षा करें, merge करें और खोजें — CI composite action, polling review bot और status-check gate के साथ।*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-github/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-github/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-github?label=version)](https://github.com/PerryLink/dsh-github/releases)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)
- **1024 स्टोर चैनल**: एक बार `npm i -g dsh1024`, फिर `dsh1024 plugin --profile web add @perrylink/dsh-github` ([deepseek1024.com](https://deepseek1024.com) इंस्टॉल रैंकिंग में गिना जाता है)।
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

</div>

---

## 📚 विषय-सूची

- [अनुकूलता](#अनुकूलता)
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
- [PerryLink DSH प्लगइन परिवार](#perrylink-dsh-प्लगइन-परिवार)
- [लाइसेंस](#लाइसेंस)

## अनुकूलता

| सतह | स्थिति |
|---|---|
| Harness | DeepSeek Harness `0.1.1-rc.2` (`0.1.1-rc.2` के लिए compat घोषित) 0.1.2-alpha.2 (2026-08-31 को अनुकूलित): सत्र लिफ़ाफ़ा अपना ignorable फ़ील्ड केवल संग्रहीत-लॉग पठन संगतता के लिए रखता है - Session.append अभी भी इसे स्टैम्प नहीं कर सकता, इसलिए गेट व्यवहार अपरिवर्तित है। |
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
# 1. bundle को अपने profile में इंस्टॉल करें
dsh plugin --profile web add "github:PerryLink/dsh-github#main"

# या npm से (प्रकाशित रिलीज़)
dsh plugin --profile web add @perrylink/dsh-github

# 2. पुनः आरंभ करें और row को सत्यापित करें
dsh --profile web --dump-config | grep -A3 'id: dsh-github'
```

## स्थापना और अनइंस्टॉल

- **git channel** (नवीनतम `main`): `dsh plugin --profile web add "github:PerryLink/dsh-github#main"` — `prepare` script केवल production dependencies के साथ build करता है।
- **npm channel** (प्रकाशित रिलीज़): `dsh plugin --profile web add @perrylink/dsh-github`।
- **tarball channel**: इस repo में `pnpm pack` चलाएँ, फिर `dsh plugin --profile web add ./dsh-github-<version>.tgz`।
- **अनइंस्टॉल**: `dsh plugin --profile web remove dsh-github` (या profile patch से row हटाएँ)।

## कॉन्फ़िगरेशन

सभी tunables Schemastery `Config` fields हैं (cordis.yml से बदले जा सकते हैं)। एक id-लक्षित override पूरी row को बदल देता है — जो key आपको चाहिए उसे दोबारा लिखें। `cordis.patch.yml` हर key को inline दस्तावेज़ित करता है।

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
- **Background review job.** `/review <pr>` `ctx.jobs` पर एक `github-review` job शुरू करता है; job metadata fetch करता है (inline posting के लिए head-commit SHA कैप्चर करते हुए), capped diff, CI checks और existing comments, फिर deterministic multi-file analyzer चलाता है (`src/review.ts`)। `reviewMode: "model"` होने पर, job capped diff को host के `subagents` seam के ज़रिए एक one-shot subagent को सौंपता है। Completion host के `dsh-tool-jobs` consumer के ज़रिए session तक पहुँचती है; model उसे `job_output` से पढ़ता है और `review_post` से प्रकाशित करता है।
- **CI composite action / review bot / status-check gate.** Repo में एक composite action (`action.yml`) शामिल है जो PRs की समीक्षा करती है, CI ठीक करती है और report लिखती है; एक polling review bot idempotent inline comments प्रकाशित करता है; और एक status-check gate PR head commit के हिसाब से verdict प्रकाशित करता है। One-shot `ci_run` tool headless run चलाता है। हर write approval-gated रहता है।

## अनुमतियाँ और डेटा

- **अनुमतियाँ**: writes official approval seam पर चलते हैं; कुछ भी re-implement या bypass नहीं किया जाता। Plugin अपने workshop manifest में `network:outbound` और `filesystem:write` घोषित करता है।
- **डेटा**: review report process memory में job id के आधार पर रहता है; disk पर कुछ भी durable नहीं लिखा जाता।
- **Session log**: plugin कोई custom session event types नहीं जोड़ता; सारा model-visible content host-logged surfaces से होकर बहता है (`tool/result`, `user/message`, `command/run`, `approval/asked`…)।

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

## PerryLink DSH प्लगइन परिवार

यह प्रोजेक्ट [PerryLink](https://github.com/PerryLink) द्वारा अनुरक्षित [33 DeepSeek Harness प्लगइनों](https://github.com/PerryLink) में से एक है। अगर यह आपकी मदद करता है, तो बाकी भी करेंगे:

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | अनुमोदन श्रृंखला पर द्वितीय-मॉडल स्वतः-समीक्षा, डिफ़ॉल्ट रूप से विफल-बंद | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | वेब UI साइडबार, संदेश और अवरोधन के साथ टिकाऊ पृष्ठभूमि चाइल्ड एजेंट | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | DeepSeek Harness के लिए लागत प्रशासन: बजट, कार्बन और विलंबता एक पैनल में। | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Claude Code /rewind-समतुल्य: स्नैपशॉट, सत्र फ़ॉर्क, एक-बार पुनर्स्थापना | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | Claude Code सत्र, मेमोरी, कौशल और CLAUDE.md को DSH में स्थानांतरित करें | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | DeepSeek Harness के लिए क्रॉस-प्लेटफ़ॉर्म नेटिव डेस्कटॉप नियंत्रण — Windows पहले। | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | वेब कंपोज़र के लिए टर्मिनल-शैली इनपुट इतिहास: तीर, Ctrl+R खोज | |
| **[dsh-dsh-data-quality](https://github.com/PerryLink/dsh-dsh-data-quality)** | डेटासेट गुणवत्ता जाँच व उद्धरण सत्यापन (यहाँ उपभोग किया गया वैकल्पिक संख्या-सेतु) | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | DeepSeek Harness के लिए प्रॉम्प्ट-इंजेक्शन, जेलब्रेक और सीक्रेट-लीक रक्षा। | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | इंजीनियरिंग-अनुशासन रक्षक: आवश्यकताओं की पूछताछ, परीक्षण द्वार, प्रतिद्वंद्वी समीक्षा | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | DeepSeek Harness के लिए एकीकृत स्थैतिक-छवि निर्माण रूटिंग। | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | DeepSeek Harness के लिए रीड-ओनली प्रदर्शन डायग्नोस्टिक्स। | |
| **[dsh-dsh-fund-research](https://github.com/PerryLink/dsh-dsh-fund-research)** | चीनी सार्वजनिक म्यूचुअल फंड के लिए नियतात्मक अनुसंधान रिपोर्ट | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | उद्योग-अनुसंधान ऑर्केस्ट्रेशन जो इस प्लगिन के `ctx.researchReport.assemble` से डिलीवरेबल सील करता है | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | DeepSeek Harness के लिए स्थानीय दस्तावेज़ ज्ञानकोश। | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | DeepSeek Harness के लिए स्थानीय-मॉडल (Ollama) एकीकरण। | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | भाषा सर्वरों पर LSP निदान, फ़ॉर्मेटिंग, पूर्णता, कोड क्रियाएँ और नाम बदलना | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | PII मास्किंग मिडलवेयर: मॉडल सीमा पर अनाम करें, डिस्प्ले लेयर पर पुनर्स्थापित करें | |
| **[dsh-dsh-mcp-panel](https://github.com/PerryLink/dsh-dsh-mcp-panel)** | केवल-पढ़ने वाला MCP रनटाइम पैनल: /mcp कमांड + स्थिति, टूल और त्रुटियों वाला Settings टैब | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | अनुमोदन-द्वारित क्रॉस-सत्र मेमोरी: ctx.memory सीम + SQLite + मेमोरी टूल | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | DeepSeek Harness के लिए OpenTelemetry और Langfuse अवलोकनीयता निर्यातक। | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Claude Code outputStyles-समतुल्य रनटाइम शैली बदलाव | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | ऑडिट के साथ Claude Code-शैली घोषणात्मक allow/deny/ask अनुमति नियम | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | माँग पर एजेंट कौशल के रूप में प्लगइन-विकास ज्ञान आधार | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | सामग्री-पता साक्ष्य और सीलबंद संस्करणों वाला सत्यापन-योग्य अनुसंधान-रिपोर्ट इंजन | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | DeepSeek Harness प्लगिनों की बहु-आयामी गुणवत्ता स्कोरिंग। | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | टिकाऊ क्रम के साथ वेब साइडबार में सत्र पिन करें | |
| **[dsh-dsh-session-sync](https://github.com/PerryLink/dsh-dsh-session-sync)** | DeepSeek Harness के लिए क्रॉस-डिवाइस सत्र सिंक — आपके सत्र स्टोर का एक समर्पित git मिरर। | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | सुरक्षा-ऑडिट कौशल पैक: गुप्त स्कैन, निर्भरता और आपूर्ति-श्रृंखला समीक्षा | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | DeepSeek Harness के लिए आवाज़-प्रथम सत्र लूप: बोलें और उत्तर सुनें। | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | DeepSeek Harness प्लगिनों के लिए पृथक इंस्टॉल-एंड-स्मोक टेस्ट ड्राइव। | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | DeepSeek Harness के लिए वेंडर पैरामीटर अनुवाद और नियतात्मक JSON मरम्मत। | |

## लाइसेंस

[Apache License 2.0](LICENSE) © 2026 dsh-github contributors
