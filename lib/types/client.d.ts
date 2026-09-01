/**
 * Browser half of `@perrylink/dsh-github` — the GitHub token configuration
 * card contributed to the "Plugins" settings section.
 * @module @perrylink/dsh-github/client
 */

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
interface CredentialsApi {
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

/** Locale copy the card renders. */
interface GithubCardLocale {
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

/** Browser context face the card consumes, as declared by src/client.ts. */
interface ClientContextLike {
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
  settingsScope: {
    bind<T>(spec: { namespace: string }): {
      getSnapshot(): { status: string; writable: boolean; value: T | undefined }
      subscribe(listener: () => void): () => void
    }
  }
  slots: {
    inject(slot: string, factory: () => unknown): unknown
    register(options: Record<string, unknown>, component: unknown): unknown
  }
}

/** Required services (cordis fiber inject). */
export declare const inject: string[]
/**
 * Mount the GitHub configuration card into the plugins settings section.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: ClientContextLike): void
