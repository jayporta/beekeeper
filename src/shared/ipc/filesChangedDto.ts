/** The most project folder names one change carries. A larger batch is sent as `all`. */
export const MAX_CHANGED_FOLDERS = 256

/**
 * The longest project folder name a change may carry, the same limit
 * `requestSchemas.ts` puts on a requested name. This file takes no dependencies
 * because the sandboxed preload bundles it.
 */
export const MAX_CHANGED_DIR_NAME_LENGTH = 255

/** What changed under `~/.claude/projects` since the last change event. */
export interface FilesChangedDto {
  /** Project folder names with changes. Empty when `all` is set. */
  readonly dirNames: readonly string[]
  /** Whether a project folder itself was created, removed or renamed. */
  readonly foldersChanged: boolean
  /** Whether the change can't be narrowed to folders, so everything visible should refresh. */
  readonly all: boolean
}
