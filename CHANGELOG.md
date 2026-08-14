# Changelog

All notable changes to this project are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
