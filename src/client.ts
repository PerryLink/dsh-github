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
import { createElement, useState, type ReactNode } from 'react'
import { SettingsForm, SettingsSecretField } from '@deepseek-ai/dsh-client-ui-primitives'

/** Dictionary namespace owned by this plugin. */
export const NS = 'dsh-github'

/** Client services this half requires; both are provided by the web shell. */
export const inject = ['slots', 'locale']

export interface ClientContextLike {
  effect(disposer: () => void, label: string): void
  locale: {
    bind(namespace: string): (key: keyof GithubCardLocale) => string
    register(namespace: string, dictionaries: Record<string, GithubCardLocale>): void
  }
  slots: {
    inject(slot: string, factory: () => unknown): unknown
    register(options: Record<string, unknown>, component: unknown): unknown
  }
}

/** Locale copy the card renders. */
export interface GithubCardLocale {
  githubTitle: string
  githubDescription: string
  tokenLabel: string
  tokenHint: string
  tokenSet: string
  tokenUnset: string
  unavailable: string
  readOnly: string
  save: string
  saving: string
  saveFailed: string
  guideIntro: string
  guideClassic: string
  guideFineGrained: string
  guideStorage: string
}

/** English copy. */
export const en: GithubCardLocale = {
  githubTitle: 'GitHub',
  githubDescription: 'GitHub pull requests, issues, and CI through the agent.',
  tokenLabel: 'GitHub token',
  tokenHint: 'Save writes this plugin\'s configuration in plain text and applies on the next GitHub operation; leave it blank to keep the current token.',
  tokenSet: 'Token configured',
  tokenUnset: 'No token',
  unavailable: 'This page has no editable configuration form; set `githubToken` in the profile configuration instead.',
  readOnly: 'This deployment stores settings read-only.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept this value; it was left for you to correct.',
  guideIntro: 'No token yet? Create a personal access token on GitHub:',
  guideClassic: 'Classic token — Settings → Developer settings → Personal access tokens (classic), scope `repo`:',
  guideFineGrained: 'Fine-grained token — pick the repositories and grant Contents, Issues, and Pull requests read/write:',
  guideStorage: 'Paste the whole string (ghp_… or github_pat_…). A token is a password: never commit it or share it.',
}

/** Simplified Chinese copy. */
export const zh: GithubCardLocale = {
  githubTitle: 'GitHub',
  githubDescription: '通过 agent 操作 GitHub 的 PR、issue 与 CI。',
  tokenLabel: 'GitHub Token',
  tokenHint: '保存后以明文写入本插件配置，下一次 GitHub 操作即生效；留空表示保持现有令牌。',
  tokenSet: '已配置',
  tokenUnset: '未配置',
  unavailable: '本页没有可编辑的配置表单；请在 profile 配置里填写 `githubToken`。',
  readOnly: '本部署的设置为只读。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受该值，已保留供你修改。',
  guideIntro: '还没有令牌？先在 GitHub 生成一个个人访问令牌（PAT）：',
  guideClassic: '经典令牌：Settings → Developer settings → Personal access tokens (classic)，勾选 `repo`：',
  guideFineGrained: '细粒度令牌：Personal access tokens (fine-grained)，选好仓库并给 Contents、Issues、Pull requests 读写：',
  guideStorage: '把整串（ghp_… 或 github_pat_…）粘到上面的输入框。令牌等同于密码，不要提交进仓库或贴到公开的地方。',
}

/** Sync state of one configuration entry, as the Plugins page projects it. */
export interface ConfigFormSnapshot<T> {
  /** `loading` until the first accepted section, `ready` while one stands, `unavailable` otherwise. */
  status: 'loading' | 'ready' | 'unavailable'
  /** Last accepted schema-resolved section; undefined before the first acceptance. */
  value: T | undefined
  /** Namespace revision fencing the next write; undefined before the first Host view. */
  revision: number | undefined
  /** Whether the Host configuration document accepts writes. */
  writable: boolean
}

/** One ordered mutation the configuration form applies to its namespace. */
export interface ConfigFormOp {
  op: 'set' | 'unset'
  path: string[]
  value?: unknown
}

/**
 * The configuration-form face the Plugins page hands a `plugins.item` entry.
 * Mirrors the page's own `ConfigPageForm`: a snapshot plus the write action.
 */
export interface ConfigPageForm<T> {
  state: ConfigFormSnapshot<T>
  mutate(ops: ConfigFormOp[], revision?: number): Promise<boolean>
}

/** The plugin configuration subset this card reads and writes. */
export interface GithubCardConfig {
  githubToken?: string
}

/** Props the slot system injects into the card component. */
export interface GithubCardProps {
  t: (key: keyof GithubCardLocale) => string
  /** The view the Plugins page asks for: the one-liner under the title, or the page body. */
  view: 'summary' | 'page'
  /** The form for this entry; absent when the page has no editable configuration for it. */
  form?: ConfigPageForm<GithubCardConfig> | undefined
}

/** Guidance list styling; everything else comes from the shipped settings primitives. */
const CARD_CSS = [
  '.ghc-guide{margin-top:12px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);}',
  '.ghc-guide p{margin:0 0 4px;}',
  '.ghc-guide ul{margin:0 0 4px;padding-left:18px;}',
  '.ghc-guide li{margin:0 0 2px;}',
  '.ghc-guide a{color:var(--dsw-alias-brand-primary);text-decoration:none;}',
  '.ghc-guide a:hover{text-decoration:underline;}',
].join('')

/**
 * Render the GitHub card: the one-liner the page shows under the card's title,
 * or the token control on the plugin's own page.
 * @param props - locale, view, and the page-supplied configuration form.
 * @returns the card's React node.
 */
export function GithubCard(props: GithubCardProps): ReactNode {
  const { t, form } = props
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const stored = (form?.state.value?.githubToken ?? '').trim()
  const configured = stored.length > 0
  // A summary render receives no `form` (the page hands it only to the detail
  // view), so it must not claim a token state it cannot read; the badge on the
  // page view is the single source of that answer.
  if (props.view === 'summary') return t('githubDescription')
  const writable = form?.state.writable ?? false
  const staged = draft.trim()
  const save = async (): Promise<void> => {
    if (form === undefined || staged === '' || saving) return
    setSaving(true)
    setFailed(false)
    let landed = false
    try {
      // No explicit revision: the form fences the write with the latest one it
      // knows, so a save queued behind another write cannot be rejected as stale.
      landed = await form.mutate([{ op: 'set', path: ['githubToken'], value: staged }])
    } catch {
      landed = false
    }
    setSaving(false)
    if (landed) setDraft('')
    else setFailed(true)
  }
  return createElement(
    SettingsForm,
    {
      labels: {
        unavailable: t('unavailable'),
        readOnly: t('readOnly'),
        saveFailed: t('saveFailed'),
        save: t('save'),
        saving: t('saving'),
      },
      state: {
        available: form !== undefined,
        writable,
        dirty: staged !== '',
        invalid: false,
        saving,
        failed,
      },
      onSave: () => { void save() },
      // SettingsForm calls this only on unmount; the draft belongs to the
      // component instance, so a fresh mount starts clean either way.
      onDiscard: () => {},
      children: [
        createElement(SettingsSecretField, {
          id: 'plugin-config-github-token',
          label: t('tokenLabel'),
          configured,
          stateLabel: configured ? t('tokenSet') : t('tokenUnset'),
          text: draft,
          hint: t('tokenHint'),
          disabled: !writable || saving,
          onEdit: (text: string) => setDraft(text),
        }),
        createElement(
          'div',
          { className: 'ghc-guide' },
          createElement('p', null, t('guideIntro')),
          createElement(
            'ul',
            null,
            createElement(
              'li',
              null,
              t('guideClassic'),
              ' ',
              createElement('a', { href: 'https://github.com/settings/tokens', target: '_blank', rel: 'noreferrer noopener' }, 'github.com/settings/tokens'),
            ),
            createElement(
              'li',
              null,
              t('guideFineGrained'),
              ' ',
              createElement('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noreferrer noopener' }, 'github.com/settings/personal-access-tokens/new'),
            ),
          ),
          createElement('p', null, t('guideStorage')),
        ),
      ],
    },
  )
}

/**
 * Mount the GitHub configuration card into the Plugins panel's Official group.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContextLike): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-github: card dictionaries')
  ctx.effect(() => {
    const tagId = `${NS}/card.css`
    if (document.querySelector(`style[data-plugin-css="${tagId}"]`) !== null) return () => {}
    const tag = document.createElement('style')
    tag.dataset.plugin = NS
    tag.dataset.pluginCss = tagId
    tag.textContent = CARD_CSS
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'dsh-github: card styles')
  ctx.slots.inject('plugins.item', () => ctx.slots.register(
    {
      name: 'plugins.item',
      id: NS,
      order: 100,
      label: () => t('githubTitle'),
      locale: NS,
    },
    GithubCard,
  ))
}
