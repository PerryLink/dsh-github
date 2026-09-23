window.__ModuleLoader__.load({ id: "@perrylink/dsh-github", factory: (require) => {
"use strict";
var module = { exports: {} };
var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  DEFAULT_TOKEN_REF: () => DEFAULT_TOKEN_REF,
  GITHUB_NS: () => GITHUB_NS,
  GithubCard: () => GithubCard,
  GithubCardController: () => GithubCardController,
  NS: () => NS,
  apply: () => apply,
  createSnapshotStore: () => createSnapshotStore,
  en: () => en,
  inject: () => inject,
  zh: () => zh
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
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
var GITHUB_NS = "dsh-github";
var DEFAULT_TOKEN_REF = "GITHUB_TOKEN";
var en = {
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
var zh = {
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
var GithubCardController = class {
  form;
  api;
  store;
  saving = false;
  failed = false;
  credential = { ref: "", configured: false, writable: true };
  /**
   * @param form - the configuration form the Plugins page hands this entry, or
   *   `undefined` when the page supplied none (the card then reads the default
   *   reference and offers the credential control alone).
   * @param api - the credentials Remote namespace.
   */
  constructor(form, api) {
    this.form = form;
    this.api = api;
    this.store = createSnapshotStore(this.projection());
    form?.subscribe(() => {
      void this.readCredential();
      this.publish();
    });
    void this.readCredential();
  }
  /** Whether the Host configuration document accepts writes. */
  writable() {
    return this.form?.getSnapshot().writable ?? true;
  }
  /** The configuration form this controller reads (identity-compared by the caller). */
  formOf() {
    return this.form;
  }
  /** Project the card's full state for its snapshot store. */
  projection() {
    return {
      writable: this.writable(),
      configured: this.credential.configured,
      credentialWritable: this.credential.writable,
      saving: this.saving,
      failed: this.failed,
      ref: this.credential.ref
    };
  }
  /** The credential reference the configuration names, or the provider default. */
  refOf() {
    const declared = this.form?.getSnapshot().value?.tokenRef;
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
      this.credential = { ref, configured: false, writable: true };
      this.publish();
    }
    let response;
    try {
      response = await this.api.describe([ref]);
    } catch {
      return;
    }
    if (!response.ok || ref !== this.refOf()) return;
    const view = response.value[ref];
    const next = { ref, configured: view?.configured ?? false, writable: view?.writable ?? true };
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
    void this.readCredential();
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
      await this.api.set(this.refOf(), text);
    } catch {
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
      submit: (value) => this.save(value)
    };
  }
  publish() {
    this.store.set(this.projection());
  }
};
function GithubCard(props) {
  const { t } = props;
  const state = props.useGithubCard((snapshot) => snapshot);
  const [draft, setDraft] = (0, import_react.useState)("");
  if (props.view === "summary") {
    return (0, import_react.createElement)(
      "span",
      { className: "ghc-summary" },
      (0, import_react.createElement)("span", null, t("githubDescription")),
      (0, import_react.createElement)(
        "span",
        { className: state.configured ? "ghc-badge" : "ghc-badgeMuted" },
        state.configured ? t("tokenSet") : t("tokenUnset")
      )
    );
  }
  const dirty = draft.trim() !== "";
  const saveLabel = state.saving ? t("saving") : t("save");
  return (0, import_react.createElement)(
    "div",
    { className: "ghc-card ghc-cardPage" },
    !state.writable ? (0, import_react.createElement)("p", { className: "ghc-readOnly", role: "status" }, t("readOnly")) : null,
    (0, import_react.createElement)(
      "div",
      { className: "ghc-field" },
      (0, import_react.createElement)(
        "div",
        { className: "ghc-head" },
        (0, import_react.createElement)("label", { className: "ghc-label", htmlFor: "plugin-config-github-token" }, t("tokenLabel")),
        (0, import_react.createElement)(
          "span",
          { className: "ghc-badges" },
          (0, import_react.createElement)(
            "span",
            { className: state.configured ? "ghc-badge" : "ghc-badgeMuted" },
            state.configured ? t("tokenSet") : t("tokenUnset")
          )
        )
      ),
      (0, import_react.createElement)("input", {
        id: "plugin-config-github-token",
        className: "ghc-input",
        type: "password",
        autoComplete: "off",
        value: draft,
        disabled: !state.credentialWritable,
        onChange: (event) => setDraft(event.target.value)
      }),
      (0, import_react.createElement)("p", { className: "ghc-hint" }, t("tokenHint"))
    ),
    (0, import_react.createElement)(
      "div",
      { className: "ghc-actions" },
      state.failed ? (0, import_react.createElement)("p", { className: "ghc-failed", role: "status" }, t("saveFailed")) : null,
      (0, import_react.createElement)(
        import_dsh_client_ui_primitives.Button,
        {
          variant: "ghost",
          size: "sm",
          disabled: !dirty || state.saving,
          onClick: () => setDraft("")
        },
        t("discard")
      ),
      (0, import_react.createElement)(
        import_dsh_client_ui_primitives.Button,
        {
          variant: "primary",
          size: "sm",
          disabled: !state.writable || !dirty || state.saving,
          icon: state.saving ? (0, import_react.createElement)("span", { className: "ghc-spin" }, (0, import_react.createElement)(import_dsh_client_ui_primitives.IconLoadingOutlineRegular, { size: 16 })) : void 0,
          onClick: async () => {
            const landed = await props.submit(draft);
            if (landed) setDraft("");
          }
        },
        saveLabel
      )
    )
  );
}
var NS = "dsh-github";
var inject = ["slots", "locale", "connection", "remote", "remote.credentials"];
function apply(ctx) {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-github: card dictionaries");
  let github;
  const controllerFor = (form) => {
    if (github === void 0 || github.formOf() !== form) {
      github = new GithubCardController(form, ctx.remote.credentials);
    }
    return github;
  };
  ctx.effect(
    () => ctx.remote.$on("credentials/reference-updated", (ref) => github?.refreshCredential(ref)),
    "dsh-github: credential invalidations"
  );
  ctx.slots.inject("plugins.item", () => ctx.slots.register(
    {
      name: "plugins.item",
      id: NS,
      order: 100,
      label: () => t("githubTitle"),
      locale: NS,
      inject: () => controllerFor(github?.formOf()).inject()
    },
    GithubCard
  ));
}
return module.exports;
} });
//# sourceMappingURL=client.js.map
