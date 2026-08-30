window.__ModuleLoader__.load({
	id: "@perrylink/dsh-github",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region D:/deepseek-harness/Project/Plugins/dsh-github/src/client.ts
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
		* The shipped `lib/client.js` is the __ModuleLoader__ bundle built from this
		* module (plain ESM here; the bundle wraps it in the loader factory). The
		* browser module loader executes that bundle, not this file.
		* @module @perrylink/dsh-github/client
		*/
		/**
		* Create the minimal card store.
		* @param init - initial state.
		* @returns the store.
		*/
		function createSnapshotStore(init) {
			let state = init;
			const listeners = /* @__PURE__ */ new Set();
			return {
				getSnapshot: () => state,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				set: (next) => {
					state = next;
					for (const listener of [...listeners]) listener();
				}
			};
		}
		/** Namespace of the GitHub capability. Spelled here rather than imported: a client package must not depend on a Host package. */
		const GITHUB_NS = "dsh-github";
		/** Credential reference the provider resolves when the section names none. */
		const DEFAULT_TOKEN_REF = "GITHUB_TOKEN";
		/** English copy. */
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
			saveFailed: "The deployment did not accept this value; it was left for you to correct."
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
			saveFailed: "本部署没有接受该值，已保留供你修改。"
		};
		/**
		* Bridges the `dsh-github` scope and the credentials domain onto the card.
		* The token is the one control that does not live in the section: its literal
		* never rides a response, so the card learns only whether one is configured
		* and writes it through the credentials domain, addressed by the reference the
		* section names.
		*/
		var GithubCardController = class {
			scope;
			api;
			store;
			saving = false;
			failed = false;
			credential = {
				ref: "",
				configured: false,
				writable: true
			};
			constructor(scope, api) {
				this.scope = scope;
				this.api = api;
				this.store = createSnapshotStore(this.projection());
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
					ref: this.credential.ref
				};
			}
			/** The credential reference the section names, or the provider default. */
			refOf() {
				const declared = this.scope.getSnapshot().value?.tokenRef;
				return declared !== void 0 && declared.length > 0 ? declared : DEFAULT_TOKEN_REF;
			}
			/**
			* Ask the credentials domain about the reference the section names. A
			* response is published only while it still answers for the reference in
			* force, so two reads settling out of order cannot clobber each other.
			*/
			async readCredential() {
				const ref = this.refOf();
				if (ref !== this.credential.ref) {
					this.credential = {
						ref,
						configured: false,
						writable: true
					};
					this.publish();
				}
				let response;
				try {
					response = await this.api.describe({ refs: [ref] });
				} catch {
					return;
				}
				if (!response.result.ok || ref !== this.refOf()) return;
				const view = response.result.value.credentials[ref];
				const next = {
					ref,
					configured: view?.configured ?? false,
					writable: view?.writable ?? true
				};
				if (next.configured === this.credential.configured && next.writable === this.credential.writable) return;
				this.credential = next;
				this.publish();
			}
			/**
			* Re-read after the Host reports a change to the reference this card
			* watches — a token can be written from elsewhere, and the section does not
			* change when it is.
			* @param ref - the reference the Host reports as changed.
			*/
			refreshCredential(ref) {
				if (ref !== this.credential.ref) return;
				this.readCredential();
			}
			/**
			* Write the staged token, then re-read whether the Host now holds one. A
			* blank value writes nothing, which keeps the stored key.
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
					await this.api.set({
						ref: this.refOf(),
						value: text
					});
				} catch {}
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
					submit: (value) => this.save(value)
				};
			}
			publish() {
				this.store.set(this.projection());
			}
		};
		/** One class name builder (static strings only — no bundler CSS modules here). */
		const cx = (...parts) => parts.filter(Boolean).join(" ");
		/**
		* Render the GitHub card: a collapsible header naming the plugin, and — once
		* expanded — the token control and the save/discard row. Renders nothing
		* while the namespace is unavailable.
		*/
		function GithubCard(props) {
			const { t } = props;
			const state = props.useGithubCard((snapshot) => snapshot);
			const [open, setOpen] = (0, react.useState)(false);
			const [draft, setDraft] = (0, react.useState)("");
			if (!state.available) return null;
			const title = t("githubTitle");
			const dirty = draft.trim() !== "";
			const saveLabel = state.saving ? t("saving") : t("save");
			return (0, react.createElement)("li", { className: cx("ghc-card", open && "ghc-cardOpen") }, (0, react.createElement)("button", {
				type: "button",
				className: "ghc-header",
				"aria-expanded": open,
				"aria-label": `${open ? "Collapse" : "Expand"}: ${title}`,
				onClick: () => setOpen(!open)
			}, (0, react.createElement)("span", { className: "ghc-headText" }, (0, react.createElement)("span", { className: "ghc-name" }, title), (0, react.createElement)("span", { className: "ghc-description" }, t("githubDescription"))), dirty ? (0, react.createElement)("span", { className: "ghc-pending" }, t("unsaved")) : null, (0, react.createElement)("span", { className: cx("ghc-chevron", open && "ghc-chevronOpen") }, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { size: 14 }))), open ? (0, react.createElement)("div", { className: "ghc-body" }, !state.writable ? (0, react.createElement)("p", {
				className: "ghc-readOnly",
				role: "status"
			}, t("readOnly")) : null, (0, react.createElement)("div", { className: "ghc-field" }, (0, react.createElement)("div", { className: "ghc-head" }, (0, react.createElement)("label", {
				className: "ghc-label",
				htmlFor: "plugin-config-github-token"
			}, t("tokenLabel")), (0, react.createElement)("span", { className: "ghc-badges" }, (0, react.createElement)("span", { className: state.configured ? "ghc-badge" : "ghc-badgeMuted" }, state.configured ? t("tokenSet") : t("tokenUnset")))), (0, react.createElement)("input", {
				id: "plugin-config-github-token",
				className: "ghc-input",
				type: "password",
				autoComplete: "off",
				value: draft,
				disabled: !state.credentialWritable,
				onChange: (event) => setDraft(event.target.value)
			}), (0, react.createElement)("p", { className: "ghc-hint" }, t("tokenHint"))), (0, react.createElement)("div", { className: "ghc-actions" }, state.failed ? (0, react.createElement)("p", {
				className: "ghc-failed",
				role: "status"
			}, t("saveFailed")) : null, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "ghost",
				size: "sm",
				disabled: !dirty || state.saving,
				onClick: () => setDraft("")
			}, t("discard")), (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "primary",
				size: "sm",
				disabled: !state.writable || !dirty || state.saving,
				icon: state.saving ? (0, react.createElement)("span", { className: "ghc-spin" }, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, { size: 16 })) : void 0,
				onClick: async () => {
					if (await props.submit(draft)) setDraft("");
				}
			}, saveLabel))) : null);
		}
		/** Dictionary namespace owned by this plugin. */
		const NS = "dsh-github";
		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"locale",
			"connection",
			"remote",
			"settingsScope"
		];
		/** Mount the GitHub configuration card into the plugins settings section. */
		function apply(ctx) {
			const connection = ctx.get("connection");
			ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-github: card dictionaries");
			const github = new GithubCardController(ctx.settingsScope.bind({ namespace: NS }), connection.api);
			ctx.effect(() => ctx.remote.$on("credentials/reference-updated", (ref) => github.refreshCredential(ref)), "dsh-github: credential invalidations");
			ctx.slots.inject("settings.plugin.item", function* () {
				yield ctx.slots.register({
					name: "settings.plugin.item",
					key: NS,
					locale: NS,
					inject: () => github.inject()
				}, GithubCard);
			});
		}
		//#endregion
		exports.DEFAULT_TOKEN_REF = DEFAULT_TOKEN_REF;
		exports.GITHUB_NS = GITHUB_NS;
		exports.GithubCard = GithubCard;
		exports.GithubCardController = GithubCardController;
		exports.NS = NS;
		exports.apply = apply;
		exports.createSnapshotStore = createSnapshotStore;
		exports.en = en;
		exports.inject = inject;
		exports.zh = zh;
		return module.exports;
	}
});
