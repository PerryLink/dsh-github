# Changelog

All notable changes to this project are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Ship `lib/client.js` as the browser bundle the DSH web shell can install, not as `tsc` output.** `0.7.12` published the Node-side compile of `src/client.ts` — top-level `import`/`export` — at `exports["./client"].default`, but `@deepseek-ai/dsh-client-modules` installs that file with `document.createElement('script')` and concatenates several packages into one combo script per batch. The browser therefore threw `SyntaxError: Cannot use import statement outside a module`, the whole batch failed to parse, and every client entry in it stayed unactivated behind a **"Failed to load plugins"** page naming `@perrylink/dsh-github`. `pnpm build` now emits the artifact in the loader's shape — `window.__ModuleLoader__.load({ id: '@perrylink/dsh-github', factory: (require) => { … } })`, with `react` and `@deepseek-ai/dsh-client-ui-primitives` left as `require(...)` for the shell's module table and everything else inlined (`scripts/client-bundle.mjs`, `scripts/build-client.mjs`) — and `esbuild` joins the devDependencies for it. The previously published `lib/client.js` was a `tsc` artifact, so this changes a shipped file; the cordis plugin face (`apply`, `inject`) and the `./client` types are unchanged.
- **Fail the build, install, and CI instead of shipping that artifact again.** `scripts/prepare.mjs` now requires *both* `typescript` and `esbuild` before it compiles anything — running `tsc` alone overwrites a good committed `lib/client.js` with plain ESM — and accepts committed artifacts only when they are a real bundle. `scripts/verify-artifacts.mjs` and the new `test/client-bundle.test.ts` execute the shipped file the way the shell does (as a classic script, against a stub `window.__ModuleLoader__`), so a leftover `import` fails with the same `SyntaxError` the browser reports, and a bare specifier the module table cannot answer fails as well.

## [0.7.15] - 2026-09-25

### Changed

- Host pins move to `0.1.7-rc.2`; re-verified against that host line. Every `@deepseek-ai/dsh-*` dev/test dependency now pins `0.1.7-rc.2`, the `dshWorkshop.compatibility.dshVersions` timeline appends `0.1.7-rc.2`, and the compatibility baseline in every README records the `dsh-v0.1.7-rc.2` host. The declared host ranges (`engines.dsh` and the `peerDependencies` union) are deliberately **unchanged** — they already admit `0.1.7-rc.2`, and a range is what the manifest accepts, not what has been tested.

## [0.7.14] - 2026-09-24

### Fixed

- **The save-in-progress spinner crashed on every host from `0.1.7-alpha.1` on.** The browser half imported `IconLoadingOutline16` from `@deepseek-ai/dsh-client-ui-primitives`, which no longer exports it: the client-wide visual unification dropped the size-in-the-name form, so the same icon is now exported once per weight as `IconLoadingOutlineRegular` / `IconLoadingOutlineMedium` and carries its size as a `size` prop. The destructured binding was therefore `undefined`, and `React.createElement(undefined, …)` throws `Element type is invalid` the moment the save control rendered its spinner. Only the identifier changed — the new component takes the same `{ size: 16 }` prop — so there is no behavioural difference. `src/client.ts` and the rebuilt `lib/client.js` both move to `IconLoadingOutlineRegular`.
- **The type gate could not have caught the above.** Three `pnpm-workspace.yaml` overrides still pinned the client line to `0.1.1-rc.2`: `@deepseek-ai/dsh-client-ui-primitives@>=0.1.0-rc.8 <0.2.0`, `@deepseek-ai/dsh-client-ui-settings@>=0.1.1-rc.2 <0.2.0` and `@deepseek-ai/dsh-tool-jobs@>=0.1.0-rc.8 <0.2.0`. The first of those is the very package the browser half compiles against, so `tsc` resolved the stale `0.1.1-rc.2` type surface, which still exported the removed name, and the build stayed green on a call that could only throw at run time (`lib/client.js` is a build artifact of `src/client.ts`, and nothing in the test suite renders it). All three rows now follow the `0.1.7-rc.1` devDep line, and re-running the gate against the corrected graph reproduces the defect directly: `src/client.ts(25,11): error TS2724: '"@deepseek-ai/dsh-client-ui-primitives"' has no exported member named 'IconLoadingOutline16'`.

### Changed

- Move the `@deepseek-ai/dsh-*` dev/test pins to the published `0.1.7-rc.1` line and record `0.1.7-rc.1` in `dshWorkshop.compatibility.dshVersions`; the monthly Compat workflow now installs the `0.1.7-rc.1` host (`@deepseek-ai/dsh`, `dsh-base` + `dsh-headless`) instead of `0.1.7-alpha.2`. The four self-referential `pnpm-workspace.yaml` override values follow the pins, as in previous line moves.
- **The `peerDependencies` ranges are unchanged, so no supported host line is dropped.** The existing four-clause band already ends in `|| >=0.1.7-0 <0.2.0`, which admits `0.1.7-rc.1`; `engines.dsh` is likewise untouched.

## [0.7.13] - 2026-09-23

### Changed

- Move the `@deepseek-ai/dsh-*` dev/test pins to the published `0.1.7-alpha.2` line and record `0.1.7-alpha.2` in `dshWorkshop.compatibility.dshVersions`; the monthly Compat workflow now installs the `0.1.7-alpha.2` host (`dsh-base` + `dsh-headless`) instead of `0.1.6-alpha.2`.
- Append the fourth host clause `|| >=0.1.7-0 <0.2.0` to `engines.dsh` and to all thirteen `@deepseek-ai/dsh-*` peer ranges, and raise the `@deepseek-ai/cordis` peer and dev/test pin to `^4.0.4`. Under semver's prerelease rule a range whose only prerelease comparators sit on earlier tuples cannot admit a later alpha, so the three-clause band excluded the very host line this release targets. No previously supported host line is dropped.
- Move the `pnpm-workspace.yaml` `overrides` block with the pins. Its four self-referential rows exist so a transitive peer's prerelease request resolves onto ONE copy of the host type graph instead of a second one; their values now follow the devDep pin to `0.1.7-alpha.2`. The KEYS stay the ranges a transitive peer spells (`@deepseek-ai/dsh-agent@^0.1.7-alpha.1`, `@deepseek-ai/dsh-llm@^0.1.7-alpha.1`, `@deepseek-ai/dsh-llm@^0.1.2-alpha.3`, `@deepseek-ai/dsh-llm@^0.1.2-alpha.4`) — they match what asks, while the value is what it resolves to. Moving the devDeps alone would have left those requests resolving to the previous line and split this package's `UserMessage`/`ContentBlock` from the host's `Agent`, which is the failure the block was written for.


## [0.7.12] - 2026-09-22

### Changed

- **Adapt to host `dsh-v0.1.7-alpha.1`.** Five confirmed breakages are fixed; the plugin no longer compiles or runs against the `0.1.6-alpha.2` faces:
  - **`ctx.jobs` contract rewritten.** The review job is now owned by the calling agent's bare `SessionId` (`spec.owner: input.owner.id`), because the registry dropped its `Agent | SessionId` union and fences access on `SessionId` alone — the old `as unknown as NonNullable<JobStartSpec['owner']>` cast is gone. `JobStart`/`JobSnapshot` became `JobSpec`/`JobView`, and `JobOutcome.output` became `JobOutcome.result` (the job's report text now travels as the producer result rather than a stream payload — `job_output` still surfaces it). `/review stop` passes `invocation.agent.id` to `jobs.kill`. `JobRegistry.start` refuses when no attached controller serves the owner, so `@deepseek-ai/dsh-tool-jobs` must be composed: the CI bot keeps its one-time-warn interval fallback for exactly that case.
  - **`@deepseek-ai/dsh-settings-file` deleted, `ctx.settingsScope` gone.** The plugin no longer registers a settings namespace (`ctx.settings.configure()` is now a page policy, not a namespace registration) and no longer injects `settings`. `tokenSource`/`tokenRef` stay ordinary cordis.yml `Config` fields — they never had independent persistence semantics — so behavior is unchanged; the exported `GithubSettingsSchema` and `GITHUB_SETTINGS_NAMESPACE` remain for importers.
  - **`@deepseek-ai/dsh-agent-presets` → `@deepseek-ai/dsh-agent-preset-registry`.** This plugin never imported the renamed package (only two now-dead `pnpm-workspace.yaml` override rows named it), so no source change was needed; those rows were removed and the `agentPresets` service key is untouched.
  - **Message source catch-all removed.** The notices commands queue now carry a plugin-owned source kind, declared by the new `src/message-source.ts` (`declare module '@deepseek-ai/dsh-llm/message' { interface MessageSourceMap { 'dsh-github': { kind: 'dsh-github' } & ContextFormed } }`) as `{ kind: 'dsh-github', form: 'notice', summary }`. The host has no `kind: 'plugin'`, and `dsh-session-format-v3-to-v4` refuses a durable row carrying one outright.
  - **Browser slot moves.** `settings.plugin.item` and `ctx.settingsScope` are gone. The card registers on `plugins.item` — now declared by `@deepseek-ai/dsh-client-ui-plugin-manager`, added to `dsh.client.inject` — and reads `tokenRef` from the `form` the page hands the entry instead of binding a scope of its own. The token control is unchanged: it still reports and writes the credential through `remote.credentials`, never the settings document. `turnTail` / `conversation.hero.agentPreset` / transcript view modes were audited and are not used by this plugin (0 hits), as is `turn/end.reason` (`forked` needs no branch here).
- Consume the host's own `ApprovalService` instead of a hand-written mirror: `@deepseek-ai/dsh-user-approval` now augments `ctx.approval`, so the plugin's duplicate `Context.approval` declaration (and its `ApprovalRequest`/`ApprovalService` types) is deleted and the CI driver's `setPolicy(exec.agent, 'never')` call is cast-free.
- Pin the `@deepseek-ai/dsh-*` dev/test dependencies to the published `0.1.7-alpha.1` alpha line, adding `@deepseek-ai/dsh-agent` and `@deepseek-ai/dsh-user-approval`, and record the two new peer entries (`dsh-agent`, `dsh-user-approval`) with the same loose range. **The `peerDependencies` ranges for the pre-existing host packages are unchanged, so no supported host line is dropped.** `pnpm-workspace.yaml` gains self-referential `@deepseek-ai/dsh-agent@^0.1.7-alpha.1` and `@deepseek-ai/dsh-llm@^0.1.7-alpha.1` override rows and loses the two dead `@deepseek-ai/dsh-agent-presets` rows: pnpm matches a prerelease range only against its own `[major, minor, patch]` tuple, so without the self-referential rows a transitive peer installs a *second* copy of the host type graph and `Agent.followup`'s `UserMessage` stops matching this package's.
- **Explicit deviation from the `0.1.5-rc.3` pin: the `@deepseek-ai/dsh-*` dev/test line is `0.1.7-alpha.1`.** `0.1.5-rc.3` is the *old-contract* next line — it still carries `SettingsProvider`/`installSection`/`SettingsScope`/`ctx.settingsScope`, `kind: 'plugin'` message sources, and `JobSnapshot`/`onJobDone` — so adapting to it would produce code that cannot compile or run against the `0.1.7-alpha.1` host this plugin targets. `0.1.7-alpha.1` is the only published line carrying the contracts this package now consumes.
- Raise the `@deepseek-ai/cordis` range from `^4.0.2` to `^4.0.3`, and `@deepseek-ai/schemastery` (dependency + devDependency) from `^3.18.2` to `^3.18.3`, plus `@deepseek-ai/cordis-plugin-loader` from `^1.0.3` to `^1.0.4`. The caret already *permitted* the newer versions, but the lockfile resolved `4.0.2`/`3.18.2`/`1.0.3`, and the `0.1.7-alpha.1` host packages declare peers of `cordis ^4.0.3` / `schemastery ^3.18.3` / `cordis-plugin-loader ^1.0.4`. A raised floor is a strictly narrower requirement, so no supported host line is dropped — but it is a floor change and is recorded as one. Verified after install: `cordis 4.0.3` (which exports `Volatile`/`VolatileSnapshot` from `@deepseek-ai/cosmokit`), `schemastery 3.18.3` (which provides `Schema.volatile()`), `cosmokit 1.8.4` resolved. This package itself declares no `.volatile()` field.
- Move the settings card from the Settings→plugins tab to the **Plugins page** (Official group): the `0.1.6-alpha.2` host deletes the `settings.plugin.item` slot, so the card registered there silently disappears. The card now registers on the keyed `plugins.item` slot (`id: dsh-github`, `order: 100`, `label` as a function, `locale`) and renders one component in two states — a one-line summary (description + token badge) and the full editable form (`view: 'summary' | 'page'`) — with the built `lib/client.js` rebuilt and committed.
- Default the CI composite action model to `deepseek-flash`: the `deepseek-v4-flash` id the action, its patch script, and the local test script referenced is removed from the harness catalog, which would silently downgrade GitHub Actions users to a text-only model.
- Drive the CI review bot's polling through `ctx.jobs.start` (kind `github-ci`) instead of `setInterval`, with a one-time-warn `setInterval` fallback when no job controller serves the agent.
- Auto-approve CI-driver writes through the official policy seam: `ctx.approval.setPolicy(agent, 'never')` pins the calling agent instead of the previous gate-only bypass.
- Consume the official `@deepseek-ai/dsh-jobs` and `@deepseek-ai/dsh-subagent` (`SubagentRun`, `SubagentStartRequest`) type faces instead of the hand-copied mirrors, and drop the plugin's own `subagents` context augmentation (the official package augments it).
- Declare `dshWorkshop.manifestVersion: 1` and the `engines.dsh` range `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0 || >=0.1.6-0 <0.2.0` (the added third clause keeps the `0.1.6` alpha line accepted).

### Fixed

- Close the type gate over the client half: `src/client.ts` is no longer excluded from `tsconfig.json` (react dev deps and the DOM lib added), and the new `tsconfig.ci.json` + `typecheck:ci` ruler covers the published line. The `lib/client.d.ts` / `lib/client.d.ts.map` / `lib/client.js.map` build artifacts are now committed alongside `lib/client.js`.
- Cover the two identity seams the `0.1.7-alpha.1` migration rewrote: a unit test asserts the review job's `owner` is the bare session-id string (not the agent object), and another asserts every queued notice carries `{ kind: 'dsh-github', form: 'notice', summary }` rather than the retired `kind: 'plugin'`.

## [0.7.10] - 2026-09-12

### Changed

- Rename the four translated READMEs to `README-<lang>.md`. npm selects the package-page readme as the first markdown file matching its `{README,README.*}` glob (`@npmcli/package-json`, publish path), and that glob order puts `README.<lang>.md` ahead of `README.md` — so npm was serving the Simplified-Chinese file for this package too (measured on 15/15 sampled packages of the family). The new names sit outside the glob, so the English source is served again. No content changed apart from the language-switcher link each translation holds to its siblings, and the repo readme gate still passes. Takes effect with the next release; an already-published version cannot gain a corrected readme retroactively.
- Pin the `@deepseek-ai/dsh-*` dev/test dependencies to the published `0.1.5-rc.2` line and record `0.1.5-rc.2` in `dshWorkshop.compatibility.dshVersions`; the monthly Compat workflow now runs against `0.1.5-rc.2`. The peer range `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0` is unchanged, so no supported host line is dropped.

## [0.7.9] - 2026-09-10

### Fixed

- The monthly **Endpoint liveness** workflow never probed anything: `actions/setup-node@v5`
  auto-enables package-manager caching from `package.json#packageManager` (pnpm here), so the
  step failed with `Unable to locate executable file: pnpm` and the probe step was skipped on
  every scheduled run (observed on the 2026-09-01 run). The job only runs `node`, so the
  automatic cache is now disabled with `package-manager-cache: false` instead of installing a
  package manager it does not use.
## [0.7.8] - 2026-09-10



### Changed

- Pin the `@deepseek-ai/dsh-*` dev/test dependencies to the published `0.1.5-rc.1` line and record `0.1.5-rc.1` in `dshWorkshop.compatibility.dshVersions`; the monthly Compat workflow now runs against `0.1.5-rc.1`. The peer range `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0` is unchanged, so no supported host line is dropped.

### Docs

- Refresh the five-language README compatibility baseline to `dsh-v0.1.5-rc.1` (verified 2026-09-10).

## [0.7.7] - 2026-09-09

### Changed

- Align the `@deepseek-ai/dsh-*` peer ranges to `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0` and pin the dev/test dependencies to the published `0.1.5-alpha.1` line: adaptation to DeepSeek Harness `dsh-v0.1.5-alpha.1` (session format V3, `ctx.agent` removal, `Inbox` type-only interface); runtime behavior is unchanged for every supported host line.
- Record `0.1.5-alpha.1` in `dshWorkshop.compatibility.dshVersions`.

### Docs

- Refresh the five-language README compatibility baseline to `dsh-v0.1.5-alpha.1` (verified 2026-09-09).

## [0.7.6] - 2026-09-07

### Docs

- Fix the DSH plugin badge URL: shields.io rejects the four-segment static badge form with "404 badge not found"; the label now uses the documented double-dash form (`dsh--plugin`), rendering identically; no behavior change.


## [0.7.5] - 2026-09-07

### Fixed

- Align the `@deepseek-ai/dsh-*` peer ranges to `>=0.1.2-rc.1 <0.2.0`: the older `>=0.1.0-rc.8 <0.2.0` band resolved to only the `0.1.0-rc.8` prerelease under registry-driven resolution and broke fresh tarball installs; no behavior change.

### Docs

- Refresh the five-language README support-version wording: the verified GitHub tag `dsh-v0.1.3-alpha.1` now leads the compatibility claim, while npm `0.1.2-rc.1` stays the published dependency-pin line (peers `>=0.1.2-rc.1 <0.2.0`); no behavior change.


## [0.7.4] - 2026-09-04

### Changed

- Align the devDependency pins and the workspace override table to the published dsh `0.1.2-rc.1` line, move the compat CI harness probes from `0.1.2-alpha.5` to `0.1.2-rc.1`, and re-verify the adaptation claims; no behavior change.

## [0.7.3] - 2026-09-02

### Changed

- Align the devDependency pins to the published dsh 0.1.2-alpha.5 line and re-verify the adaptation claims; no behavior change.

## [0.7.2] - 2026-09-01

### Fixed

- Host half: drop the removed `settingsNamespace` import from
  `@deepseek-ai/dsh-settings` (absent from the published `0.1.2-alpha.2`
  line onward) and register the settings namespace with the `'dsh-github'`
  literal, which the settings service brands internally.
- Browser half: route the credential card off the retired `connection.api`
  face (absent on the alpha client) onto the `remote.credentials` Remote
  namespace (`describe`/`set`); `inject` now names `remote.credentials`,
  and the rebuilt `lib/client.js` carries the new wire calls. The
  `credentials/reference-updated` listener stays on `remote.$on`.

### Changed

- Dev pins bumped to `0.1.2-alpha.3` (`@deepseek-ai/dsh-util-values`,
  `dsh-attachment`, `dsh-credentials`, `dsh-llm`, `dsh-session`,
  `dsh-settings`, `dsh-tools`), `@deepseek-ai/schemastery` to `^3.18.2`,
  and the `@deepseek-ai/cordis` peer to `^4.0.2`; the peer ranges stay
  `>=0.1.0-rc.8 <0.2.0` (and their rc.2/UI companions) — no tightening.
- Compat declared for `0.1.2-alpha.3`: five-language READMEs,
  `dshWorkshop.compatibility`, and the compat workflow (CLI/base/headless).

## [0.7.1] - 2026-08-30

### Changed

- Migrate the browser half off the removed `dsh-client-runtime`: the settings
  scope and the snapshot store are local structural contracts (the store's
  previous home `dsh-client-store` is not on the published `0.1.1-rc.2` line),
  the client context is the plain cordis `Context`, and the `dsh.client.inject`
  list now names `dsh-client-ui-settings` — the package that provides the
  `settingsScope` service on both host lines. The committed `lib/client.js`
  bundle no longer requires `@deepseek-ai/dsh-client-runtime/client`.

## [0.7.0] - 2026-08-26

### Added

- GraphQL client additions for search, batch, and PR checks over a unified REST+GraphQL transport.

## [0.6.5] - 2026-08-23

### Changed

- Declared `packageManager: pnpm@11.7.0` so Corepack and CI resolve a reproducible pnpm version.

## [0.6.4] - 2026-08-22

### Changed

- DSH dev dependencies pinned to `0.1.1-rc.2` (`@deepseek-ai/dsh-credentials`, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-session`, `@deepseek-ai/dsh-settings`, `@deepseek-ai/dsh-tools`); the peer ranges stay `>=0.1.0-rc.8 <0.2.0` because no rc.2-only API is required.
- Compat declaration updated to DeepSeek Harness `0.1.1-rc.2` (READMEs, `dshWorkshop.compatibility`, and the compat workflow).

### Fixed

- `test/ci.test.ts` "no token" case now injects a `runGh` fake so it stays hermetic against a locally-authenticated `gh` CLI.

## [0.6.3] - 2026-08-21

### Changed

- DSH dev/peer dependencies pinned to `0.1.0-rc.8` (`@deepseek-ai/dsh-credentials`, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-session`, `@deepseek-ai/dsh-tools`); the peer ranges are widened to `>=0.1.0-rc.8 <0.2.0`.
- Compat declaration updated to DeepSeek Harness `0.1.0-rc.8` (READMEs, `dshWorkshop.compatibility`, and the compat workflow).

## [0.6.2] - 2026-08-17

### Fixed

- The bundle patch row now names the package exactly as published (`@perrylink/dsh-github`). The previous bare name made the row unresolvable in a clean profile, so the plugin failed to load with `ERR_MODULE_NOT_FOUND`.

## [0.6.1] - 2026-08-16

### Added

- Local-machine protection for the action scripts: `action-patch.mjs` and `action-post.mjs` refuse to run outside a GitHub Actions runner (no `RUNNER_TEMP` / `GITHUB_WORKSPACE`), and the new `scripts/local-test.mjs` simulates the composite action in a fully isolated sandbox — `DSH_HOME`, `DSH_PROFILE_DIR`, and the output directory are hardcoded under the system temp directory, overriding any inherited (machine-scope) `DSH_HOME`.
- Regression coverage for the CI-context guards in `test/action-guard.test.ts`, plus local-testing notes in all five READMEs.

## [0.6.0] - 2026-08-16

### Added

- **CI integration surface**: a composite GitHub Action (`action.yml`) that reviews PRs, fixes CI, and writes the report; a polling review bot with idempotent inline comments and a status-check gate published per PR head commit; and the one-shot `ci_run` tool plus the `/ci` command family.
- `ci` config section: master switch, review engine (`static`/`model`), CI-driver auto-approve list, status-check name and blocking behavior, fail-on severity, poll interval, label/path filters, sensitive-path and test-existence rules, change-size caps, concurrency cap, comment posting, and report directory.
- `ci.run` write action joins the `allowedActions` default list.
- `requestTimeoutMs` config: hard per-request timeout that aborts the fetch when exceeded.

### Changed

- The README "planned v2 companion repository" note is replaced: the CI / GitHub Action surface now ships in this repository.

## [0.5.0] - 2026-08-15

### Added

- `pr_merge` tool: merge a pull request with `merge` / `squash` / `rebase`, optional commit title/message, and optional head-branch deletion after the merge (approval-gated, action `pr.merge`). The tool passes the head-commit SHA for consistency and reports branch-deletion failures as a note without failing the merge.
- `pr_update` tool: edit a pull request's title, body, state (`open`/`closed`), or target branch (approval-gated, action `pr.update`; at least one field required).
- `gh_repo` tool: read a repository's metadata (description, default branch, visibility, stars, forks, open issues, language, license, topics, last update). Concurrency-safe.
- `gh_file` tool: read one file from a repository at a branch, tag, or commit (base64-decoded, capped by the new `maxFileChars` config, per-call `maxChars` override); directories are reported as a structured `is-directory` error. Concurrency-safe.
- Analyzer tunables moved into configuration: `maxFindings` (default 50) and `maxLineLength` (default 300) replace the hardcoded constants in `src/review.ts`.
- Secondary-rate-limit resilience: the REST client now retries **403 responses carrying a `Retry-After` header** (GitHub's secondary-limit / abuse-detection signal) under the same `maxRetries` / backoff / signal rules as 429s; 403s without `Retry-After` still fail fast as permission denials.
- 204 No Content responses are handled by the JSON client (needed by the branch-deletion call).
- `test/present.test.ts`: pure-function coverage for the new UI cards plus the `review_post` body-size indicator.
- The `check:readmes` gate now also asserts that every README mentions every tool and config key from the source, that no README pins a versioned tarball name, and that CHANGELOG.md carries a section for the current version.
- Real-API e2e smoke for the contents endpoint (base64 decode path).

### Changed

- `/pr create` refuses detached-HEAD checkouts with a structured `no-head` error instead of sending the literal branch name `HEAD` to the API.
- `/review post` and the `review_post` approval reason label model-review jobs "model review" instead of "0 finding(s)".
- `review_post` inline mode omits the `comments` key entirely for body-only reviews (no line-anchored findings) instead of posting an empty array.
- The `review_post` pending card records the body override as a character count (`bodyChars`) rather than dropping it or dumping the text.
- `allowedActions` defaults now include `pr.merge` and `pr.update`.
- README install channels reference `dsh-github-<version>.tgz` instead of a stale pinned version.

## [0.4.1] - 2026-08-14

### Fixed

- The unit suite is now hermetic against the environment: a developer's or CI's `GITHUB_TOKEN` no longer leaks into "no token" tests (a setup file removes it before unit tests run). The opt-in real-API smoke tests now gate on the dedicated `DSH_GITHUB_E2E_TOKEN` variable instead.

## [0.4.0] - 2026-08-14

### Added

- Published to npm as `@perrylink/dsh-github` (the unscoped `dsh-github` name is owned by an unrelated project on the registry; the plugin's module name stays `dsh-github`).

- `issue_comment` tool: comment on an issue or pull request (approval-gated, action `issue.comment`).
- `issue_close` tool: close an issue with an optional `state_reason` (`completed` / `not_planned`; approval-gated, action `issue.close`).
- `gh_search` tool: search issues and pull requests across repositories with the separate search quota surfaced.
- `review_post` `mode: "inline"`: posts line-anchored review comments against the PR head commit via `POST /pulls/{n}/reviews` (the background job now captures the head-commit SHA). `mode: "summary"` remains the default.
- `review_post` `body` parameter: override the drafted comment before posting; approval reasons preview the override.
- Background review jobs now fetch PR metadata, CI check runs, and existing review comments; the completion output carries the CI summary and comment count. `/review` accepts `--max-diff <n>`, `--no-ci`, `--no-comments`.
- `gh_review` returns the full capped diff as `diff.text` (the render excerpt is bounded by the new `renderExcerptChars` config) and reports per-section fetch failures via `diff.error` / `comments.error` / `ci.error` instead of swallowing them.
- `gh_issue` items carry `kind: issue | pr | comment`; pull requests in listings are marked, and real comment payloads map correctly.
- Rate-limit facts now ride every result: write successes and all structured errors.
- Analyzer rules: `google-api-key` and `hardcoded-credential` detection.
- Review-job record map is capped by the new `maxReviewRecords` config (oldest settled records evict first).
- GitHub Enterprise support in origin parsing: `repoFromRemoteUrl` matches the configured `apiBaseUrl` host.
- `reviewMode: "model"` config: background review jobs can delegate the capped diff to a one-shot subagent through the host's `subagents` seam (the owning agent is the parent; the child's Markdown output becomes the postable report). The default `static` mode stays deterministic and token-free; `modelReviewProvider` selects the provider, and a missing seam or provider fails loud.
- Opt-in real-API smoke tests (`test/e2e.test.ts`) that self-skip without `GITHUB_TOKEN`.
- CI workflow (`.github/workflows/ci.yml`) and a `check:readmes` script wired into `package.json`.

### Changed

- Approval reasons preview titles, body sizes, and review-body overrides.
- Posted review comments escape diff-derived file names (backticks + HTML) so hostile PRs cannot inject Markdown.
- `/review stop` and `/review <pr>` return clean command errors for unknown jobs and missing job controllers (with `dsh-tool-jobs` guidance).
- `maxDiffChars` is documented as a character cap (matching the implementation).

### Fixed

- Removed the unused `@deepseek-ai/dsh-scope` peer/dev dependency.
- Removed the duplicated `RepoStateView` interface declaration in `src/state.ts`.
- Fixed the module JSDoc reference to a README section that did not exist.
- Read-tool presenters now render structured error cards instead of assuming success values.

### Security

- README token wording corrected: the token is read per operation from the configured source and sent only in the Authorization header (it was never exclusively "in the credential layer").
- Documented the prompt-injection surface of GitHub content (issue/PR bodies, comments, search results) in the README security section.

## [0.1.0] - 2026-08-14

### Added

- Initial release: `pr_create`, `gh_review`, `review_post`, `gh_issue`, `issue_open` tools; `/pr`, `/review`, `/issue` command families; approval-gated writes; credential-seam token resolution; 429 retry with rate-limit surfacing; deterministic background review jobs.
