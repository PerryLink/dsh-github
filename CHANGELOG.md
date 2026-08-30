# Changelog

All notable changes to this project are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
