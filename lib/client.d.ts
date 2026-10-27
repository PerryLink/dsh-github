/**
 * dsh-github browser half — one card in the Plugins panel's Official group.
 *
 * The card reads and writes the plugin's own `Config.githubToken` through the
 * configuration form the page hands a `plugins.item` entry (`form.state` and
 * `form.mutate`), so the token stays one host-owned field and the host half
 * resolves it on every operation. The browser half deliberately depends on no
 * credentials remote: DSH 0.2.1 no longer exposes one (`remote.credentials` /
 * `remote.credentialsController` are gone), and a missing required client
 * service leaves the whole entry pending, which fails the web boot.
 *
 * Rendering uses the shipped `SettingsForm` / `SettingsSecretField`, so the
 * card inherits the standard settings layout and every theme token a skin
 * overrides; the only local CSS is the guidance list below.
 *
 * The shipped `lib/client.js` is the built bundle of this module. The browser
 * module loader executes that bundle, not this file.
 * @module @perrylink/dsh-github/client
 */
import { type ReactNode } from 'react';
/** Dictionary namespace owned by this plugin. */
export declare const NS = "dsh-github";
/** Client services this half requires; both are provided by the web shell. */
export declare const inject: string[];
export interface ClientContextLike {
    effect(disposer: () => void, label: string): void;
    locale: {
        bind(namespace: string): (key: keyof GithubCardLocale) => string;
        register(namespace: string, dictionaries: Record<string, GithubCardLocale>): void;
    };
    slots: {
        inject(slot: string, factory: () => unknown): unknown;
        register(options: Record<string, unknown>, component: unknown): unknown;
    };
}
/** Locale copy the card renders. */
export interface GithubCardLocale {
    githubTitle: string;
    githubDescription: string;
    tokenLabel: string;
    tokenHint: string;
    tokenSet: string;
    tokenUnset: string;
    unavailable: string;
    readOnly: string;
    save: string;
    saving: string;
    saveFailed: string;
    guideIntro: string;
    guideClassic: string;
    guideFineGrained: string;
    guideStorage: string;
}
/** English copy. */
export declare const en: GithubCardLocale;
/** Simplified Chinese copy. */
export declare const zh: GithubCardLocale;
/** Sync state of one configuration entry, as the Plugins page projects it. */
export interface ConfigFormSnapshot<T> {
    /** `loading` until the first accepted section, `ready` while one stands, `unavailable` otherwise. */
    status: 'loading' | 'ready' | 'unavailable';
    /** Last accepted schema-resolved section; undefined before the first acceptance. */
    value: T | undefined;
    /** Namespace revision fencing the next write; undefined before the first Host view. */
    revision: number | undefined;
    /** Whether the Host configuration document accepts writes. */
    writable: boolean;
}
/** One ordered mutation the configuration form applies to its namespace. */
export interface ConfigFormOp {
    op: 'set' | 'unset';
    path: string[];
    value?: unknown;
}
/**
 * The configuration-form face the Plugins page hands a `plugins.item` entry.
 * Mirrors the page's own `ConfigPageForm`: a snapshot plus the write action.
 */
export interface ConfigPageForm<T> {
    state: ConfigFormSnapshot<T>;
    mutate(ops: ConfigFormOp[], revision?: number): Promise<boolean>;
}
/** The plugin configuration subset this card reads and writes. */
export interface GithubCardConfig {
    githubToken?: string;
}
/** Props the slot system injects into the card component. */
export interface GithubCardProps {
    t: (key: keyof GithubCardLocale) => string;
    /** The view the Plugins page asks for: the one-liner under the title, or the page body. */
    view: 'summary' | 'page';
    /** The form for this entry; absent when the page has no editable configuration for it. */
    form?: ConfigPageForm<GithubCardConfig> | undefined;
}
/**
 * Render the GitHub card: the one-liner the page shows under the card's title,
 * or the token control on the plugin's own page.
 * @param props - locale, view, and the page-supplied configuration form.
 * @returns the card's React node.
 */
export declare function GithubCard(props: GithubCardProps): ReactNode;
/**
 * Mount the GitHub configuration card into the Plugins panel's Official group.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: ClientContextLike): void;
//# sourceMappingURL=client.d.ts.map