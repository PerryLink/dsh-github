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
 * The card registers into the Plugins page's `plugins.item` list slot and
 * renders the two views the page asks for: `summary` is the one-liner under
 * the card's title, `page` is the form with its own save control. The page
 * draws the title, icon, and crumb itself; buttons come from the shared
 * primitives.
 *
 * The shipped `lib/client.js` is the __ModuleLoader__ bundle built from this
 * module (plain ESM here; the bundle wraps it in the loader factory). The
 * browser module loader executes that bundle, not this file.
 * @module @perrylink/dsh-github/client
 */
import { createElement, useState } from 'react';
import { Button, IconLoadingOutline16, } from '@deepseek-ai/dsh-client-ui-primitives';
/**
 * Create the minimal card store.
 * @param init - initial state.
 * @returns the store.
 */
export function createSnapshotStore(init) {
    let state = init;
    const listeners = new Set();
    return {
        getSnapshot: () => state,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        set: (next) => {
            state = next;
            for (const listener of [...listeners])
                listener();
        },
    };
}
/** Namespace of the GitHub capability. Spelled here rather than imported: a client package must not depend on a Host package. */
export const GITHUB_NS = 'dsh-github';
/** Credential reference the provider resolves when the section names none. */
export const DEFAULT_TOKEN_REF = 'GITHUB_TOKEN';
/** English copy. */
export const en = {
    githubTitle: 'GitHub',
    githubDescription: 'GitHub pull requests, issues, and CI through the agent.',
    tokenLabel: 'GitHub token',
    tokenHint: 'Stored in the credentials file, not here. Applied immediately; leave blank to keep the current token.',
    tokenSet: 'A token is configured.',
    tokenUnset: 'No token is configured; GitHub tools are unavailable until one is.',
    unsaved: 'Unsaved',
    readOnly: 'This deployment stores settings read-only.',
    save: 'Save',
    saving: 'Saving…',
    discard: 'Discard',
    saveFailed: 'The deployment did not accept this value; it was left for you to correct.',
};
/** Simplified Chinese copy. */
export const zh = {
    githubTitle: 'GitHub',
    githubDescription: '通过 agent 操作 GitHub 的 PR、issue 与 CI。',
    tokenLabel: 'GitHub Token',
    tokenHint: '写入凭证文件而非设置文件；保存后立即生效。留空表示保持现有令牌。',
    tokenSet: '已配置令牌。',
    tokenUnset: '未配置令牌；配置之前 GitHub 工具不可用。',
    unsaved: '未保存',
    readOnly: '本部署的设置为只读。',
    save: '保存',
    saving: '保存中…',
    discard: '放弃修改',
    saveFailed: '本部署没有接受该值，已保留供你修改。',
};
/**
 * Bridges the `dsh-github` scope and the credentials domain onto the card.
 * The token is the one control that does not live in the section: its literal
 * never rides a response, so the card learns only whether one is configured
 * and writes it through the credentials domain, addressed by the reference the
 * section names.
 */
export class GithubCardController {
    scope;
    api;
    store;
    saving = false;
    failed = false;
    credential = { ref: '', configured: false, writable: true };
    constructor(scope, api) {
        this.scope = scope;
        this.api = api;
        this.store = createSnapshotStore(this.projection());
        scope.subscribe(() => {
            void this.readCredential();
            this.publish();
        });
        void this.readCredential();
    }
    /** Project the card's full state for its snapshot store. */
    projection() {
        const snapshot = this.scope.getSnapshot();
        return {
            available: snapshot.status === 'ready',
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
        const declared = this.scope.getSnapshot().value?.tokenRef;
        return declared !== undefined && declared.length > 0 ? declared : DEFAULT_TOKEN_REF;
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
        }
        catch {
            return;
        }
        if (!response.ok || ref !== this.refOf())
            return;
        const view = response.value[ref];
        const next = { ref, configured: view?.configured ?? false, writable: view?.writable ?? true };
        if (next.configured === this.credential.configured && next.writable === this.credential.writable)
            return;
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
        if (ref !== this.credential.ref)
            return;
        void this.readCredential();
    }
    /**
     * Write the staged token, then re-read whether the Host now holds one. A
     * blank value writes nothing, which keeps the stored key.
     * @param value - the staged credential literal.
     * @returns whether the Host reports a configured credential afterwards.
     */
    async save(value) {
        const text = (value ?? '').trim();
        if (text === '' || this.saving)
            return false;
        this.saving = true;
        this.failed = false;
        this.publish();
        try {
            await this.api.set(this.refOf(), text);
        }
        catch {
            // handled below by re-reading the configured state
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
}
/**
 * Render the GitHub card. `summary` renders the one-liner the Plugins page
 * places under the card's title (the description plus the token state badge);
 * `page` renders the token control and the save/discard row on the plugin's
 * own page. Renders nothing while the namespace is unavailable.
 */
export function GithubCard(props) {
    const { t } = props;
    const state = props.useGithubCard((snapshot) => snapshot);
    const [draft, setDraft] = useState('');
    if (!state.available)
        return null;
    if (props.view === 'summary') {
        return createElement('span', { className: 'ghc-summary' }, createElement('span', null, t('githubDescription')), createElement('span', { className: state.configured ? 'ghc-badge' : 'ghc-badgeMuted' }, state.configured ? t('tokenSet') : t('tokenUnset')));
    }
    const dirty = draft.trim() !== '';
    const saveLabel = state.saving ? t('saving') : t('save');
    return createElement('div', { className: 'ghc-card ghc-cardPage' }, !state.writable
        ? createElement('p', { className: 'ghc-readOnly', role: 'status' }, t('readOnly'))
        : null, createElement('div', { className: 'ghc-field' }, createElement('div', { className: 'ghc-head' }, createElement('label', { className: 'ghc-label', htmlFor: 'plugin-config-github-token' }, t('tokenLabel')), createElement('span', { className: 'ghc-badges' }, createElement('span', { className: state.configured ? 'ghc-badge' : 'ghc-badgeMuted' }, state.configured ? t('tokenSet') : t('tokenUnset')))), createElement('input', {
        id: 'plugin-config-github-token',
        className: 'ghc-input',
        type: 'password',
        autoComplete: 'off',
        value: draft,
        disabled: !state.credentialWritable,
        onChange: (event) => setDraft(event.target.value),
    }), createElement('p', { className: 'ghc-hint' }, t('tokenHint'))), createElement('div', { className: 'ghc-actions' }, state.failed ? createElement('p', { className: 'ghc-failed', role: 'status' }, t('saveFailed')) : null, createElement(Button, {
        variant: 'ghost',
        size: 'sm',
        disabled: !dirty || state.saving,
        onClick: () => setDraft(''),
    }, t('discard')), createElement(Button, {
        variant: 'primary',
        size: 'sm',
        disabled: !state.writable || !dirty || state.saving,
        icon: state.saving
            ? createElement('span', { className: 'ghc-spin' }, createElement(IconLoadingOutline16, { size: 16 }))
            : undefined,
        onClick: async () => {
            const landed = await props.submit(draft);
            if (landed)
                setDraft('');
        },
    }, saveLabel)));
}
/** Dictionary namespace owned by this plugin. */
export const NS = 'dsh-github';
/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope', 'remote.credentials'];
/** Mount the GitHub configuration card into the Plugins page's Official group. */
export function apply(ctx) {
    const t = ctx.locale.bind(NS);
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-github: card dictionaries');
    const github = new GithubCardController(ctx.settingsScope.bind({ namespace: NS }), ctx.remote.credentials);
    ctx.effect(() => ctx.remote.$on('credentials/reference-updated', (ref) => github.refreshCredential(ref)), 'dsh-github: credential invalidations');
    ctx.slots.inject('plugins.item', () => ctx.slots.register({
        name: 'plugins.item',
        id: NS,
        order: 100,
        label: () => t('githubTitle'),
        locale: NS,
        inject: () => github.inject(),
    }, GithubCard));
}
//# sourceMappingURL=client.js.map