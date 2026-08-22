/**
 * dsh-github browser half — one card in the "Plugins" settings section.
 *
 * The card edits the `dsh-github` settings namespace and lets the user fill
 * the GitHub token directly from the settings page. The token literal never
 * rides the settings document: it is written through the credentials domain,
 * addressed by the reference the namespace names (`tokenRef`, default
 * `GITHUB_TOKEN`), which is exactly where the host half resolves it — per
 * operation, no restart needed.
 *
 * The card is collapsible and mirrors the host's `PluginCard` chrome one for
 * one (same design tokens, same layout), the way the market card does: the
 * plugins tab only lays out a flex column and dispatches
 * `settings.plugin.item`, so the container is ours to draw, but drawing it
 * with the same tokens is what keeps it from looking like it wandered in from
 * another product. Buttons and the chevron come from the shared primitives.
 *
 * This file is a self-contained bundle executed by the browser module loader.
 */
window.__ModuleLoader__.load({
	id: "@perrylink/dsh-github",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");

		// ── styles (mirrors the host PluginCard / market card tokens) ────────────

		const css = [
			"/* @perrylink/dsh-github: token configuration card */",
			".ghc-card{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-3,#fff);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}",
			".ghc-card:hover{border-color:var(--dsw-alias-label-dimmed,#c8ccd4)}",
			".ghc-cardOpen{background:var(--dsw-alias-bg-layer-2,#f7f8fa);border-color:var(--dsw-alias-label-dimmed,#c8ccd4)}",
			".ghc-header{-webkit-appearance:none;appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}",
			".ghc-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4f6ef7);outline-offset:-2px}",
			".ghc-headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}",
			".ghc-name{color:var(--dsw-alias-label-primary,#1f2328);font-size:15px;font-weight:600;line-height:1.4}",
			".ghc-description{color:var(--dsw-alias-label-tertiary,#8b93a1);font-size:13px;line-height:1.5}",
			".ghc-chevron{color:var(--dsw-alias-label-tertiary,#8b93a1);flex:none;transition:transform .16s;display:inline-flex}",
			".ghc-chevronOpen{transform:rotate(180deg)}",
			".ghc-pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform,#eef0f4);color:var(--dsw-alias-label-secondary,#6b7280);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}",
			".ghc-body{border-top:1px solid var(--dsw-alias-border-l2,#e5e7eb);margin:0 16px;padding-bottom:8px}",
			".ghc-readOnly{color:var(--dsw-alias-label-tertiary,#8b93a1);margin:12px 0 0;font-size:12px;line-height:1.5}",
			".ghc-field{flex-direction:column;gap:6px;padding:12px 0;display:flex}",
			".ghc-head{align-items:center;gap:8px;display:flex}",
			".ghc-label{min-width:0;color:var(--dsw-alias-label-primary,#1f2328);flex:1;font-size:13px;font-weight:500;line-height:1.5}",
			".ghc-badges{align-items:center;gap:8px;display:inline-flex}",
			".ghc-badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform,#eef0f4);color:var(--dsw-alias-label-secondary,#6b7280);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}",
			".ghc-badgeMuted{white-space:nowrap;color:var(--dsw-alias-label-tertiary,#8b93a1);border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px}",
			".ghc-input{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-3,#fff);height:34px;font:inherit;color:var(--dsw-alias-label-primary,#1f2328);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}",
			".ghc-input:focus-visible{border-color:var(--dsw-alias-brand-primary,#4f6ef7);outline:none}",
			".ghc-input:disabled{color:var(--dsw-alias-label-tertiary,#8b93a1);cursor:default}",
			".ghc-hint{color:var(--dsw-alias-label-tertiary,#8b93a1);margin:0;font-size:12px;line-height:1.5}",
			".ghc-actions{border-top:1px solid var(--dsw-alias-border-l2,#e5e7eb);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}",
			".ghc-failed{min-width:0;color:var(--dsw-alias-label-error,#dc2626);flex:1;margin:0;font-size:12px;line-height:1.5}",
			".ghc-spin{display:inline-flex;animation:ghc-spin .8s linear infinite}",
			"@keyframes ghc-spin{to{transform:rotate(360deg)}}",
		].join("");
		const tagId = "@perrylink/dsh-github/github-card.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@perrylink/dsh-github";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		// ── locale ───────────────────────────────────────────────────────────────

		/** English copy for the card. */
		const en = {
			githubTitle: "GitHub",
			githubDescription: "GitHub pull requests, issues, and CI through the agent.",
			tokenLabel: "GitHub token",
			tokenHint: "Stored in the credentials file, not here. Applied immediately; leave blank to keep the current token.",
			tokenSet: "A token is configured.",
			tokenUnset: "No token is configured; GitHub tools are unavailable until one is.",
			unsaved: "Unsaved",
			readOnly: "This deployment stores settings read-only.",
			save: "Save",
			saving: "Saving…",
			discard: "Discard",
			saveFailed: "The deployment did not accept this value; it was left for you to correct.",
		};
		/** Simplified Chinese copy. */
		const zh = {
			githubTitle: "GitHub",
			githubDescription: "通过 agent 操作 GitHub 的 PR、issue 与 CI。",
			tokenLabel: "GitHub Token",
			tokenHint: "写入凭证文件而非设置文件；保存后立即生效。留空表示保持现有令牌。",
			tokenSet: "已配置令牌。",
			tokenUnset: "未配置令牌；配置之前 GitHub 工具不可用。",
			unsaved: "未保存",
			readOnly: "本部署的设置为只读。",
			save: "保存",
			saving: "保存中…",
			discard: "放弃修改",
			saveFailed: "本部署没有接受该值，已保留供你修改。",
		};

		// ── controller ───────────────────────────────────────────────────────────

		/**
		 * Namespace of the GitHub capability. Spelled here rather than imported:
		 * a client package must not depend on a Host package.
		 */
		const GITHUB_NS = "dsh-github";
		/** Credential reference the provider resolves when the section names none. */
		const DEFAULT_TOKEN_REF = "GITHUB_TOKEN";

		/**
		 * Bridges the `dsh-github` scope and the credentials domain onto the
		 * card. The token is the one control that does not live in the section:
		 * its literal never rides a response, so the card learns only whether
		 * one is configured and writes it through the credentials domain,
		 * addressed by the reference the section names.
		 */
		var GithubCardController = class {
			scope;
			api;
			store;
			saving = false;
			failed = false;
			credential = { ref: "", configured: false, writable: true };
			constructor(scope, api) {
				this.scope = scope;
				this.api = api;
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(this.projection());
				scope.subscribe(() => {
					this.readCredential();
					this.publish();
				});
				this.readCredential();
			}
			/** Project the card's full state for its snapshot store. */
			projection() {
				const snapshot = this.scope.getSnapshot();
				return {
					available: snapshot.status === "ready",
					writable: snapshot.writable,
					configured: this.credential.configured,
					credentialWritable: this.credential.writable,
					saving: this.saving,
					failed: this.failed,
					ref: this.credential.ref,
				};
			}
			/** The credential reference the section names, or the provider default. */
			refOf() {
				const snapshot = this.scope.getSnapshot();
				const declared = snapshot.value?.tokenRef;
				return declared !== void 0 && declared.length > 0 ? declared : DEFAULT_TOKEN_REF;
			}
			/**
			 * Ask the credentials domain about the reference the section names.
			 * A response is published only while it still answers for the
			 * reference in force, so two reads settling out of order cannot
			 * clobber each other.
			 */
			async readCredential() {
				const ref = this.refOf();
				if (ref !== this.credential.ref) {
					this.credential = { ref, configured: false, writable: true };
					this.publish();
				}
				let response;
				try {
					response = await this.api.credentials.describe({ refs: [ref] });
				} catch (_credentialReadFailure) {
					return;
				}
				if (!response.result.ok || ref !== this.refOf()) return;
				const view = response.result.value.credentials[ref];
				const next = { ref, configured: view?.configured ?? false, writable: view?.writable ?? true };
				if (next.configured === this.credential.configured && next.writable === this.credential.writable) return;
				this.credential = next;
				this.publish();
			}
			/**
			 * Re-read after the Host reports a change to the reference this card
			 * watches — a token can be written from elsewhere, and the section
			 * does not change when it is.
			 * @param ref - the reference the Host reports as changed.
			 */
			refreshCredential(ref) {
				if (ref !== this.credential.ref) return;
				this.readCredential();
			}
			/**
			 * Write the staged token, then re-read whether the Host now holds
			 * one. A blank value writes nothing, which keeps the stored key.
			 * @param value - the staged credential literal.
			 * @returns whether the Host reports a configured credential afterwards.
			 */
			async save(value) {
				const text = (value ?? "").trim();
				if (text === "" || this.saving) return false;
				this.saving = true;
				this.failed = false;
				this.publish();
				try {
					await this.api.credentials.set({ ref: this.refOf(), value: text });
				} catch (_credentialWriteFailure) {
				}
				await this.readCredential();
				const landed = this.credential.configured;
				this.saving = false;
				this.failed = !landed;
				this.publish();
				return landed;
			}
			/** Build the face the card's slot registration injects. */
			inject() {
				return {
					hooks: { githubCard: this.store },
					submit: (value) => this.save(value),
				};
			}
			publish() {
				this.store.set(this.projection());
			}
		};

		// ── card component ───────────────────────────────────────────────────────

		/**
		 * Render the GitHub card: a collapsible header naming the plugin, and —
		 * once expanded — the token control and the save/discard row.
		 * Renders nothing while the namespace is unavailable.
		 */
		function GithubCard(props) {
			const { t } = props;
			const state = props.useGithubCard((snapshot) => snapshot);
			const [open, setOpen] = react.useState(false);
			const [draft, setDraft] = react.useState("");
			if (!state.available) return null;
			const title = t("githubTitle");
			const dirty = draft.trim() !== "";
			const saveLabel = state.saving ? t("saving") : t("save");
			return react.createElement("li", {
				className: "ghc-card" + (open ? " ghc-cardOpen" : ""),
			},
				react.createElement("button", {
					type: "button",
					className: "ghc-header",
					"aria-expanded": open,
					"aria-label": (open ? "Collapse" : "Expand") + ": " + title,
					onClick: () => setOpen(!open),
				},
					react.createElement("span", { className: "ghc-headText" },
						react.createElement("span", { className: "ghc-name" }, title),
						react.createElement("span", { className: "ghc-description" }, t("githubDescription")),
					),
					dirty ? react.createElement("span", { className: "ghc-pending" }, t("unsaved")) : null,
					react.createElement("span", { className: "ghc-chevron" + (open ? " ghc-chevronOpen" : "") },
						react.createElement(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { size: 14 }),
					),
				),
				open ? react.createElement("div", { className: "ghc-body" },
					!state.writable ? react.createElement("p", { className: "ghc-readOnly", role: "status" }, t("readOnly")) : null,
					react.createElement("div", { className: "ghc-field" },
						react.createElement("div", { className: "ghc-head" },
							react.createElement("label", { className: "ghc-label", htmlFor: "plugin-config-github-token" }, t("tokenLabel")),
							react.createElement("span", { className: "ghc-badges" },
								react.createElement("span", { className: state.configured ? "ghc-badge" : "ghc-badgeMuted" },
									state.configured ? t("tokenSet") : t("tokenUnset"),
								),
							),
						),
						react.createElement("input", {
							id: "plugin-config-github-token",
							className: "ghc-input",
							type: "password",
							autoComplete: "off",
							value: draft,
							disabled: !state.credentialWritable,
							onChange: (event) => setDraft(event.target.value),
						}),
						react.createElement("p", { className: "ghc-hint" }, t("tokenHint")),
					),
					react.createElement("div", { className: "ghc-actions" },
						state.failed ? react.createElement("p", { className: "ghc-failed", role: "status" }, t("saveFailed")) : null,
						react.createElement(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							disabled: !dirty || state.saving,
							onClick: () => setDraft(""),
						}, t("discard")),
						react.createElement(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							size: "sm",
							disabled: !state.writable || !dirty || state.saving,
							icon: state.saving ? react.createElement("span", { className: "ghc-spin" },
								react.createElement(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, { size: 16 }),
							) : void 0,
							onClick: async () => {
								const landed = await props.submit(draft);
								if (landed) setDraft("");
							},
						}, saveLabel),
					),
				) : null,
			);
		}

		// ── entry ────────────────────────────────────────────────────────────────

		/** Dictionary namespace owned by this plugin. */
		const NS = "dsh-github";
		/** Required services (cordis fiber inject). */
		const inject = ["slots", "locale", "connection", "remote", "settingsScope"];

		/**
		 * Mount the GitHub configuration card into the plugins settings section.
		 * @param ctx - the browser plugin context.
		 */
		function apply(ctx) {
			const { api } = ctx.get("connection");
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-github: card dictionaries");
			const github = new GithubCardController(ctx.settingsScope.bind({ namespace: NS }), api);
			ctx.effect(() => ctx.remote.$on("credentials/reference-updated", (ref) => {
				github.refreshCredential(ref);
			}), "dsh-github: credential invalidations");
			ctx.slots.inject("settings.plugin.item", function* () {
				yield ctx.slots.register({
					name: "settings.plugin.item",
					key: NS,
					locale: NS,
					inject: () => github.inject(),
				}, GithubCard);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
