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
import { createElement, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  Button, IconLoadingOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'

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
  status: 'loading' | 'ready' | 'unavailable'
  /** Last accepted schema-resolved section; undefined before the first acceptance. */
  value: T | undefined
  /** Composition layer the Host resolved the value over, when the owning plugin declared one. */
  base: unknown
  /** Raw user layer as stored, when one exists. */
  user: unknown
  /** Namespace revision fencing the next write; undefined before the first Host view. */
  revision: number | undefined
  /** Whether the Host document accepts writes; memory mode never does. */
  writable: boolean
  /** `host` syncs with the Host document; `memory` keeps a remote browser process-local. */
  mode: 'host' | 'memory'
}

/** Reactive owner handle over one configuration entry's accepted values. */
export interface ConfigForm<T> {
  /** @returns the current sync snapshot (stable reference until the next change). */
  getSnapshot(): ConfigFormSnapshot<T>
  /**
   * Observe snapshot replacements.
   * @param listener - invoked after each snapshot change.
   * @returns the disposer removing this listener.
   */
  subscribe(listener: () => void): () => void
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
  getSnapshot(): T
  /**
   * Subscribe to snapshot replacements.
   * @param listener - invoked after each change.
   * @returns the disposer removing this listener.
   */
  subscribe(listener: () => void): () => void
  /**
   * Replace the state wholesale.
   * @param next - next state.
   */
  set(next: T): void
}

/**
 * Create the minimal card store.
 * @param init - initial state.
 * @returns the store.
 */
export function createSnapshotStore<T>(init: T): SnapshotStore<T> {
  let state = init
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (next) => {
      state = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/** Namespace of the GitHub capability. Spelled here rather than imported: a client package must not depend on a Host package. */
export const GITHUB_NS = 'dsh-github'
/** Credential reference the provider resolves when the configuration names none. */
export const DEFAULT_TOKEN_REF = 'GITHUB_TOKEN'

/** Locale copy the card renders. */
export interface GithubCardLocale {
  githubTitle: string
  githubDescription: string
  tokenLabel: string
  tokenHint: string
  tokenSet: string
  tokenUnset: string
  unsaved: string
  readOnly: string
  save: string
  saving: string
  discard: string
  saveFailed: string
}

/** English copy. */
export const en: GithubCardLocale = {
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
}

/** Simplified Chinese copy. */
export const zh: GithubCardLocale = {
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
}

/** The card's full state, as projected into its snapshot store. */
export interface GithubCardState {
  /** Whether the Host configuration document accepts writes. */
  writable: boolean
  /** Whether the referenced credential is configured. */
  configured: boolean
  /** Whether the credentials domain accepts writes. */
  credentialWritable: boolean
  /** Whether a save is crossing the wire. */
  saving: boolean
  /** Whether the last save did not land as staged. */
  failed: boolean
  /** The credential reference the card addresses. */
  ref: string
}

/** Source and writability facts for one credential reference (never the value). */
interface CredentialView {
  /** Whether resolving the reference would currently return a value. */
  configured: boolean
  /** Source layer currently supplying the value; absent while unconfigured. */
  source?: string
  /** Whether the active provider can write this reference. */
  writable: boolean
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
  describe(refs: string[]): Promise<
    | { readonly ok: true; readonly value: Record<string, CredentialView> }
    | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }
  >
  /**
   * Store one non-empty value under a reference.
   */
  set(ref: string, value: string): Promise<unknown>
}

/** The configuration the card reads its credential reference from (the plugin's own `Config` subset). */
interface GithubCardConfig {
  tokenRef?: string
}

/**
 * Bridges the page-supplied configuration form and the credentials domain onto
 * the card. The token is the one control that does not live in the
 * configuration: its literal never rides a response, so the card learns only
 * whether one is configured and writes it through the credentials domain,
 * addressed by the reference `Config.tokenRef` names.
 */
export class GithubCardController {
  private readonly form: ConfigForm<GithubCardConfig> | undefined
  private readonly api: CredentialsApi
  private readonly store: SnapshotStore<GithubCardState>
  private saving = false
  private failed = false
  private credential: { ref: string; configured: boolean; writable: boolean } = { ref: '', configured: false, writable: true }

  /**
   * @param form - the configuration form the Plugins page hands this entry, or
   *   `undefined` when the page supplied none (the card then reads the default
   *   reference and offers the credential control alone).
   * @param api - the credentials Remote namespace.
   */
  constructor(form: ConfigForm<GithubCardConfig> | undefined, api: CredentialsApi) {
    this.form = form
    this.api = api
    this.store = createSnapshotStore(this.projection())
    form?.subscribe(() => {
      void this.readCredential()
      this.publish()
    })
    void this.readCredential()
  }

  /** Whether the Host configuration document accepts writes. */
  writable(): boolean {
    return this.form?.getSnapshot().writable ?? true
  }

  /** The configuration form this controller reads (identity-compared by the caller). */
  formOf(): ConfigForm<GithubCardConfig> | undefined {
    return this.form
  }

  /** Project the card's full state for its snapshot store. */
  projection(): GithubCardState {
    return {
      writable: this.writable(),
      configured: this.credential.configured,
      credentialWritable: this.credential.writable,
      saving: this.saving,
      failed: this.failed,
      ref: this.credential.ref,
    }
  }

  /** The credential reference the configuration names, or the provider default. */
  refOf(): string {
    const declared = this.form?.getSnapshot().value?.tokenRef
    return declared !== undefined && declared.length > 0 ? declared : DEFAULT_TOKEN_REF
  }

  /**
   * Ask the credentials domain about the reference the section names. A
   * response is published only while it still answers for the reference in
   * force, so two reads settling out of order cannot clobber each other.
   */
  async readCredential(): Promise<void> {
    const ref = this.refOf()
    if (ref !== this.credential.ref) {
      this.credential = { ref, configured: false, writable: true }
      this.publish()
    }
    let response
    try {
      response = await this.api.describe([ref])
    } catch {
      return
    }
    if (!response.ok || ref !== this.refOf()) return
    const view = response.value[ref]
    const next = { ref, configured: view?.configured ?? false, writable: view?.writable ?? true }
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) return
    this.credential = next
    this.publish()
  }

  /**
   * Re-read after the Host reports a change to the reference this card
   * watches — a token can be written from elsewhere, and the section does not
   * change when it is.
   * @param ref - the reference the Host reports as changed.
   */
  refreshCredential(ref: string): void {
    if (ref !== this.credential.ref) return
    void this.readCredential()
  }

  /**
   * Write the staged token, then re-read whether the Host now holds one. A
   * blank value writes nothing, which keeps the stored key.
   * @param value - the staged credential literal.
   * @returns whether the Host reports a configured credential afterwards.
   */
  async save(value: string): Promise<boolean> {
    const text = (value ?? '').trim()
    if (text === '' || this.saving) return false
    this.saving = true
    this.failed = false
    this.publish()
    try {
      await this.api.set(this.refOf(), text)
    } catch {
      // handled below by re-reading the configured state
    }
    await this.readCredential()
    const landed = this.credential.configured
    this.saving = false
    this.failed = !landed
    this.publish()
    return landed
  }

  /** Build the face the card's slot registration injects. */
  inject(): { hooks: { githubCard: SnapshotStore<GithubCardState> }; submit: (value: string) => Promise<boolean> } {
    return {
      hooks: { githubCard: this.store },
      submit: (value) => this.save(value),
    }
  }

  private publish(): void {
    this.store.set(this.projection())
  }
}

/** Props the slot system injects into the card component. */
export interface GithubCardProps {
  t: (key: keyof GithubCardLocale) => string
  useGithubCard: (selector: (snapshot: GithubCardState) => GithubCardState) => GithubCardState
  submit: (value: string) => Promise<boolean>
  /** The view the Plugins page asks for: the one-liner under the title, or the page body. */
  view: 'summary' | 'page'
}

/**
 * Render the GitHub card. `summary` renders the one-liner the Plugins page
 * places under the card's title (the description plus the token state badge);
 * `page` renders the token control and the save/discard row on the plugin's
 * own page. The page supplies the configuration form, so the card never
 * depends on a served namespace to render.
 */
export function GithubCard(props: GithubCardProps): ReactNode {
  const { t } = props
  const state = props.useGithubCard((snapshot) => snapshot)
  const [draft, setDraft] = useState('')
  if (props.view === 'summary') {
    return createElement(
      'span',
      { className: 'ghc-summary' },
      createElement('span', null, t('githubDescription')),
      createElement(
        'span',
        { className: state.configured ? 'ghc-badge' : 'ghc-badgeMuted' },
        state.configured ? t('tokenSet') : t('tokenUnset'),
      ),
    )
  }
  const dirty = draft.trim() !== ''
  const saveLabel = state.saving ? t('saving') : t('save')
  return createElement(
    'div',
    { className: 'ghc-card ghc-cardPage' },
    !state.writable
      ? createElement('p', { className: 'ghc-readOnly', role: 'status' }, t('readOnly'))
      : null,
    createElement(
      'div',
      { className: 'ghc-field' },
      createElement(
        'div',
        { className: 'ghc-head' },
        createElement('label', { className: 'ghc-label', htmlFor: 'plugin-config-github-token' }, t('tokenLabel')),
        createElement(
          'span',
          { className: 'ghc-badges' },
          createElement(
            'span',
            { className: state.configured ? 'ghc-badge' : 'ghc-badgeMuted' },
            state.configured ? t('tokenSet') : t('tokenUnset'),
          ),
        ),
      ),
      createElement('input', {
        id: 'plugin-config-github-token',
        className: 'ghc-input',
        type: 'password',
        autoComplete: 'off',
        value: draft,
        disabled: !state.credentialWritable,
        onChange: (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
      }),
      createElement('p', { className: 'ghc-hint' }, t('tokenHint')),
    ),
    createElement(
      'div',
      { className: 'ghc-actions' },
      state.failed ? createElement('p', { className: 'ghc-failed', role: 'status' }, t('saveFailed')) : null,
      createElement(
        Button,
        {
          variant: 'ghost',
          size: 'sm',
          disabled: !dirty || state.saving,
          onClick: () => setDraft(''),
        },
        t('discard'),
      ),
      createElement(
        Button,
        {
          variant: 'primary',
          size: 'sm',
          disabled: !state.writable || !dirty || state.saving,
          icon: state.saving
            ? createElement('span', { className: 'ghc-spin' }, createElement(IconLoadingOutline16, { size: 16 }))
            : undefined,
          onClick: async () => {
            const landed = await props.submit(draft)
            if (landed) setDraft('')
          },
        },
        saveLabel,
      ),
    ),
  )
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'dsh-github'
/**
 * Required services (cordis fiber inject). `settingsScope` is gone: host
 * 0.1.7-alpha.1 removed it, and the Plugins page now hands the configuration
 * form to the `plugins.item` entry instead. `@deepseek-ai/dsh-client-ui-plugin-manager`
 * owns that slot, so it must be composed for the card to mount at all.
 */
export const inject = ['slots', 'locale', 'connection', 'remote', 'remote.credentials']

export interface ClientContextLike {
  get(service: string): unknown
  effect(disposer: () => void, label: string): void
  locale: {
    bind(namespace: string): (key: keyof GithubCardLocale) => string
    register(namespace: string, dictionaries: Record<string, GithubCardLocale>): void
  }
  remote: {
    $on(event: string, listener: (ref: string) => void): unknown
    credentials: CredentialsApi
  }
  slots: {
    inject(slot: string, factory: () => unknown): unknown
    register(options: Record<string, unknown>, component: unknown): unknown
  }
}

/** The `form` member the Plugins page hands a `plugins.item` entry. */
interface PluginConfigViewProps {
  readonly view: 'summary' | 'page'
  readonly form?: ConfigForm<GithubCardConfig> | undefined
}

/**
 * Mount the GitHub configuration card into the Plugins page's Official group.
 *
 * The form arrives per render, so the controller is rebuilt whenever the page
 * supplies a different one — the page's own form owner stays authoritative and
 * the card keeps no second copy of the accepted values.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContextLike): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-github: card dictionaries')
  let github: GithubCardController | undefined
  const controllerFor = (form: PluginConfigViewProps['form']): GithubCardController => {
    if (github === undefined || github.formOf() !== form) {
      github = new GithubCardController(form, ctx.remote.credentials)
    }
    return github
  }
  ctx.effect(
    () => ctx.remote.$on('credentials/reference-updated', (ref) => github?.refreshCredential(ref)),
    'dsh-github: credential invalidations',
  )
  ctx.slots.inject('plugins.item', () => ctx.slots.register(
    {
      name: 'plugins.item',
      id: NS,
      order: 100,
      label: () => t('githubTitle'),
      locale: NS,
      inject: () => controllerFor(github?.formOf()).inject(),
    },
    GithubCard,
  ))
}
