/**
 * dsh-github browser half — one card in the Plugins page's Official group.
 *
 * The card reports and edits the GitHub token. The token literal never rides
 * the settings document: it is written through the credentials domain,
 * addressed by the reference the plugin's cordis.yml `Config.tokenRef` names
 * (default `GITHUB_TOKEN`), which is exactly where the host half resolves it —
 * per operation, no restart needed.
 *
 * Since host 0.1.7-alpha.1 the page owns configuration: the card renders the
 * `summary` one-liner and the `page` body from the `plugins.item` owner props
 * (`view`, and the `form` the Plugins page supplies), instead of binding a
 * `settingsScope` itself — that service, `settings.plugin.item`'s old shape,
 * and the `dsh-settings-file` package behind them were all removed. The card
 * therefore reads `tokenRef` from `form.state.value` and never writes the
 * settings document; the credential is written through the credentials
 * domain, which is a different seam and stayed.
 *
 * The shipped `lib/client.js` is the built bundle of this module. The browser
 * module loader executes that bundle, not this file.
 * @module @perrylink/dsh-github/client
 */
import { type ReactNode } from 'react';
/**
 * The configuration-form contract the card consumes, declared locally: a
 * client package must not import a Host package, and the browser half of the
 * seam lives in `@deepseek-ai/dsh-client-ui-settings`, which is an optional
 * peer. Mirrors that package's `ConfigForm`/`ConfigFormSnapshot` faces — the
 * ones the Plugins page hands a `plugins.item` entry as `form`.
 */
/** Client-side sync state of one configuration entry. */
export interface ConfigFormSnapshot<T> {
    /** `loading` until the first accepted section, `ready` while one stands, `unavailable` otherwise. */
    status: 'loading' | 'ready' | 'unavailable';
    /** Last accepted schema-resolved section; undefined before the first acceptance. */
    value: T | undefined;
    /** Composition layer the Host resolved the value over, when the owning plugin declared one. */
    base: unknown;
    /** Raw user layer as stored, when one exists. */
    user: unknown;
    /** Namespace revision fencing the next write; undefined before the first Host view. */
    revision: number | undefined;
    /** Whether the Host document accepts writes; memory mode never does. */
    writable: boolean;
    /** `host` syncs with the Host document; `memory` keeps a remote browser process-local. */
    mode: 'host' | 'memory';
}
/** Reactive owner handle over one configuration entry's accepted values. */
export interface ConfigForm<T> {
    /** @returns the current sync snapshot (stable reference until the next change). */
    getSnapshot(): ConfigFormSnapshot<T>;
    /**
     * Observe snapshot replacements.
     * @param listener - invoked after each snapshot change.
     * @returns the disposer removing this listener.
     */
    subscribe(listener: () => void): () => void;
}
/**
 * Minimal writable snapshot store the card's slot hooks consume. Declared and
 * implemented locally: its previous home `dsh-client-store` is not on the
 * published `0.1.1-rc.2` line, and the card only needs the bare observable
 * contract plus whole-value replacement (no drafts, no persistence) — the
 * framework synthesizes the selector hook from `getSnapshot`/`subscribe`.
 */
export interface SnapshotStore<T> {
    /** @returns the current snapshot reference. */
    getSnapshot(): T;
    /**
     * Subscribe to snapshot replacements.
     * @param listener - invoked after each change.
     * @returns the disposer removing this listener.
     */
    subscribe(listener: () => void): () => void;
    /**
     * Replace the state wholesale.
     * @param next - next state.
     */
    set(next: T): void;
}
/**
 * Create the minimal card store.
 * @param init - initial state.
 * @returns the store.
 */
export declare function createSnapshotStore<T>(init: T): SnapshotStore<T>;
/** Namespace of the GitHub capability. Spelled here rather than imported: a client package must not depend on a Host package. */
export declare const GITHUB_NS = "dsh-github";
/** Credential reference the provider resolves when the configuration names none. */
export declare const DEFAULT_TOKEN_REF = "GITHUB_TOKEN";
/** Locale copy the card renders. */
export interface GithubCardLocale {
    githubTitle: string;
    githubDescription: string;
    tokenLabel: string;
    tokenHint: string;
    tokenSet: string;
    tokenUnset: string;
    unsaved: string;
    readOnly: string;
    save: string;
    saving: string;
    discard: string;
    saveFailed: string;
}
/** English copy. */
export declare const en: GithubCardLocale;
/** Simplified Chinese copy. */
export declare const zh: GithubCardLocale;
/** The card's full state, as projected into its snapshot store. */
export interface GithubCardState {
    /** Whether the Host configuration document accepts writes. */
    writable: boolean;
    /** Whether the referenced credential is configured. */
    configured: boolean;
    /** Whether the credentials domain accepts writes. */
    credentialWritable: boolean;
    /** Whether a save is crossing the wire. */
    saving: boolean;
    /** Whether the last save did not land as staged. */
    failed: boolean;
    /** The credential reference the card addresses. */
    ref: string;
}
/** Source and writability facts for one credential reference (never the value). */
interface CredentialView {
    /** Whether resolving the reference would currently return a value. */
    configured: boolean;
    /** Source layer currently supplying the value; absent while unconfigured. */
    source?: string;
    /** Whether the active provider can write this reference. */
    writable: boolean;
}
/**
 * The credentials-domain wire face the card uses: the host `credentials` Remote
 * namespace (`remote.credentials`). The token literal crosses the wire on
 * `set` only — no read path returns it.
 */
export interface CredentialsApi {
    /**
     * Ask the credentials domain about references; one view per requested name,
     * keyed by that name.
     */
    describe(refs: string[]): Promise<{
        readonly ok: true;
        readonly value: Record<string, CredentialView>;
    } | {
        readonly ok: false;
        readonly error: {
            readonly code: string;
            readonly message: string;
        };
    }>;
    /**
     * Store one non-empty value under a reference.
     */
    set(ref: string, value: string): Promise<unknown>;
}
/** The configuration the card reads its credential reference from (the plugin's own `Config` subset). */
interface GithubCardConfig {
    tokenRef?: string;
}
/**
 * Bridges the page-supplied configuration form and the credentials domain onto
 * the card. The token is the one control that does not live in the
 * configuration: its literal never rides a response, so the card learns only
 * whether one is configured and writes it through the credentials domain,
 * addressed by the reference `Config.tokenRef` names.
 */
export declare class GithubCardController {
    private readonly form;
    private readonly api;
    private readonly store;
    private saving;
    private failed;
    private credential;
    /**
     * @param form - the configuration form the Plugins page hands this entry, or
     *   `undefined` when the page supplied none (the card then reads the default
     *   reference and offers the credential control alone).
     * @param api - the credentials Remote namespace.
     */
    constructor(form: ConfigForm<GithubCardConfig> | undefined, api: CredentialsApi);
    /** Whether the Host configuration document accepts writes. */
    writable(): boolean;
    /** The configuration form this controller reads (identity-compared by the caller). */
    formOf(): ConfigForm<GithubCardConfig> | undefined;
    /** Project the card's full state for its snapshot store. */
    projection(): GithubCardState;
    /** The credential reference the configuration names, or the provider default. */
    refOf(): string;
    /**
     * Ask the credentials domain about the reference the section names. A
     * response is published only while it still answers for the reference in
     * force, so two reads settling out of order cannot clobber each other.
     */
    readCredential(): Promise<void>;
    /**
     * Re-read after the Host reports a change to the reference this card
     * watches — a token can be written from elsewhere, and the section does not
     * change when it is.
     * @param ref - the reference the Host reports as changed.
     */
    refreshCredential(ref: string): void;
    /**
     * Write the staged token, then re-read whether the Host now holds one. A
     * blank value writes nothing, which keeps the stored key.
     * @param value - the staged credential literal.
     * @returns whether the Host reports a configured credential afterwards.
     */
    save(value: string): Promise<boolean>;
    /** Build the face the card's slot registration injects. */
    inject(): {
        hooks: {
            githubCard: SnapshotStore<GithubCardState>;
        };
        submit: (value: string) => Promise<boolean>;
    };
    private publish;
}
/** Props the slot system injects into the card component. */
export interface GithubCardProps {
    t: (key: keyof GithubCardLocale) => string;
    useGithubCard: (selector: (snapshot: GithubCardState) => GithubCardState) => GithubCardState;
    submit: (value: string) => Promise<boolean>;
    /** The view the Plugins page asks for: the one-liner under the title, or the page body. */
    view: 'summary' | 'page';
}
/**
 * Render the GitHub card. `summary` renders the one-liner the Plugins page
 * places under the card's title (the description plus the token state badge);
 * `page` renders the token control and the save/discard row on the plugin's
 * own page. The page supplies the configuration form, so the card never
 * depends on a served namespace to render.
 */
export declare function GithubCard(props: GithubCardProps): ReactNode;
/** Dictionary namespace owned by this plugin. */
export declare const NS = "dsh-github";
/**
 * Required services (cordis fiber inject). `settingsScope` is gone: host
 * 0.1.7-alpha.1 removed it, and the Plugins page now hands the configuration
 * form to the `plugins.item` entry instead. `@deepseek-ai/dsh-client-ui-plugin-manager`
 * owns that slot, so it must be composed for the card to mount at all.
 */
export declare const inject: string[];
export interface ClientContextLike {
    get(service: string): unknown;
    effect(disposer: () => void, label: string): void;
    locale: {
        bind(namespace: string): (key: keyof GithubCardLocale) => string;
        register(namespace: string, dictionaries: Record<string, GithubCardLocale>): void;
    };
    remote: {
        $on(event: string, listener: (ref: string) => void): unknown;
        credentials: CredentialsApi;
    };
    slots: {
        inject(slot: string, factory: () => unknown): unknown;
        register(options: Record<string, unknown>, component: unknown): unknown;
    };
}
/**
 * Mount the GitHub configuration card into the Plugins page's Official group.
 *
 * The form arrives per render, so the controller is rebuilt whenever the page
 * supplies a different one — the page's own form owner stays authoritative and
 * the card keeps no second copy of the accepted values.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: ClientContextLike): void;
export {};
//# sourceMappingURL=client.d.ts.map