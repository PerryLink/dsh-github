import type { CommandDefinition, CommandsService, JobRegistry } from './types.ts';
import type { GithubState } from './state.ts';
/** Register the /pr command family. */
export declare function registerPrCommand(commands: CommandsService, state: GithubState): () => void;
/** Register the /review command family. */
export declare function registerReviewCommand(commands: CommandsService, jobs: JobRegistry, state: GithubState): () => void;
/** Register the /issue command family. */
export declare function registerIssueCommand(commands: CommandsService, state: GithubState): () => void;
/** Register all three command families; returns the combined disposer. */
export declare function registerCommands(commands: CommandsService, jobs: JobRegistry, state: GithubState): () => void;
export type { CommandDefinition };
//# sourceMappingURL=commands.d.ts.map