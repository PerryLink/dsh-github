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
import { createElement, useState, type ReactNode } from 'react'
import {
  Button, IconChevronDownOutline14, IconLoadingOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * The settings-namespace scope contract the card consumes, declared locally:
 * the owning package differs across host lines (the removed
 * `dsh-client-runtime` on `0.1.1-rc.2`, `dsh-client-ui-settings` on
 * `0.1.2-alpha.1`), and the runtime contract is structural. Mirrors the
 * owning seam's `SettingsScope`/`SettingsScopeSnapshot` faces.
 */

/** Client-side sync state of one settings namespace. */
export interface SettingsScopeSnapshot<T> {
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

/** Reactive owner handle over one namespace's durable section. */
export interface SettingsScope<T> {
  /** @returns the current sync snapshot (stable reference until the next change). */
  getSnapshot(): SettingsScopeSnapshot<T>
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
/** Credential reference the provider resolves when the section names none. */
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
  /** False while the namespace is not served to this client; the card renders nothing. */
  available: boolean
  /** Whether the Host settings document accepts writes. */
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

/** The section's settings value shape (subset of the Host schema). */
interface GithubSettingsSection {
  tokenRef?: string
}

/**
 * Bridges the `dsh-github` scope and the credentials domain onto the card.
 * The token is the one control that does not live in the section: its literal
 * never rides a response, so the card learns only whether one is configured
 * and writes it through the credentials domain, addressed by the reference the
 * section names.
 */
export class GithubCardController {
  private readonly scope: SettingsScope<GithubSettingsSection>
  private readonly api: CredentialsApi
  private readonly store: SnapshotStore<GithubCardState>
  private saving = false
  private failed = false
  private credential: { ref: string; configured: boolean; writable: boolean } = { ref: '', configured: false, writable: true }

  constructor(scope: SettingsScope<GithubSettingsSection>, api: CredentialsApi) {
    this.scope = scope
    this.api = api
    this.store = createSnapshotStore(this.projection())
    scope.subscribe(() => {
      void this.readCredential()
      this.publish()
    })
    void this.readCredential()
  }

  /** Project the card's full state for its snapshot store. */
  projection(): GithubCardState {
    const snapshot = this.scope.getSnapshot()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      configured: this.credential.configured,
      credentialWritable: this.credential.writable,
      saving: this.saving,
      failed: this.failed,
      ref: this.credential.ref,
    }
  }

  /** The credential reference the section names, or the provider default. */
  refOf(): string {
    const declared = this.scope.getSnapshot().value?.tokenRef
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
}

/** One class name builder (static strings only — no bundler CSS modules here). */
const cx = (...parts: Array<string | false | undefined>): string => parts.filter(Boolean).join(' ')

/**
 * Render the GitHub card: a collapsible header naming the plugin, and — once
 * expanded — the token control and the save/discard row. Renders nothing
 * while the namespace is unavailable.
 */
export function GithubCard(props: GithubCardProps): ReactNode {
  const { t } = props
  const state = props.useGithubCard((snapshot) => snapshot)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  if (!state.available) return null
  const title = t('githubTitle')
  const dirty = draft.trim() !== ''
  const saveLabel = state.saving ? t('saving') : t('save')
  return createElement(
    'li',
    { className: cx('ghc-card', open && 'ghc-cardOpen') },
    createElement(
      'button',
      {
        type: 'button',
        className: 'ghc-header',
        'aria-expanded': open,
        'aria-label': `${open ? 'Collapse' : 'Expand'}: ${title}`,
        onClick: () => setOpen(!open),
      },
      createElement(
        'span',
        { className: 'ghc-headText' },
        createElement('span', { className: 'ghc-name' }, title),
        createElement('span', { className: 'ghc-description' }, t('githubDescription')),
      ),
      dirty ? createElement('span', { className: 'ghc-pending' }, t('unsaved')) : null,
      createElement(
        'span',
        { className: cx('ghc-chevron', open && 'ghc-chevronOpen') },
        createElement(IconChevronDownOutline14, { size: 14 }),
      ),
    ),
    open
      ? createElement(
          'div',
          { className: 'ghc-body' },
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
              onChange: (event) => setDraft(event.target.value),
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
      : null,
  )
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'dsh-github'
/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope', 'remote.credentials']

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
  settingsScope: { bind<T>(spec: { namespace: string }): SettingsScope<T> }
  slots: {
    inject(slot: string, factory: () => unknown): unknown
    register(options: Record<string, unknown>, component: unknown): unknown
  }
}

/** Mount the GitHub configuration card into the plugins settings section. */
export function apply(ctx: ClientContextLike): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-github: card dictionaries')
  const github = new GithubCardController(
    ctx.settingsScope.bind<GithubSettingsSection>({ namespace: NS }),
    ctx.remote.credentials,
  )
  ctx.effect(
    () => ctx.remote.$on('credentials/reference-updated', (ref) => github.refreshCredential(ref)),
    'dsh-github: credential invalidations',
  )
  ctx.slots.inject('settings.plugin.item', function* () {
    yield ctx.slots.register(
      {
        name: 'settings.plugin.item',
        key: NS,
        locale: NS,
        inject: () => github.inject(),
      },
      GithubCard,
    )
  })
}
