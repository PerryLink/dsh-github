/**
 * Browser half of `@perrylink/dsh-github` — the GitHub token configuration
 * card contributed to the "Plugins" settings section.
 * @module @perrylink/dsh-github/client
 */
import type { Context } from '@deepseek-ai/cordis';
/** Required services (cordis fiber inject). */
export declare const inject: string[];
/**
 * Mount the GitHub configuration card into the plugins settings section.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: Context): void;
