import type {
  GitAvailabilityDto,
  UncommittedStatusDto,
  WorktreeDiffCodeDto
} from './worktreeDiffDto'

/** One changed file's patch. */
export interface WorktreePatchFileDto {
  /** The file's path, or for a rename or copy its new path. Repo-controlled: render as plain text only. */
  readonly path: string
  /** The path a rename or copy came from. Repo-controlled: render as plain text only. */
  readonly oldPath?: string
  /**
   * The file's patch as unified diff text, header lines included. Repo-controlled:
   * render as plain text only. Cut at a whole line when `truncated`, and empty
   * when the total cap was already reached. A binary file's patch says it differs.
   */
  readonly patch: string
  /** Whether the patch was cut, or left out, to stay within the per-file or total size cap. */
  readonly truncated: boolean
}

/**
 * What a worktree agent's patch request came to: git unusable, the diff
 * failed, or the patches.
 */
export type WorktreePatchDto =
  | {
      /** Git is missing or too old, so no patch was read. */
      readonly kind: 'unavailable'
      /** Why git isn't usable. */
      readonly git: Exclude<GitAvailabilityDto, 'ok'>
    }
  | {
      /** The patch couldn't be read for this agent. */
      readonly kind: 'failed'
      /** Why, as a code only. */
      readonly code: WorktreeDiffCodeDto
    }
  | {
      /** The patches. */
      readonly kind: 'ready'
      /** Whether the patches include uncommitted work, and why not when they don't. */
      readonly uncommitted: UncommittedStatusDto
      /** One entry per changed file, in git's order. */
      readonly files: readonly WorktreePatchFileDto[]
      /** Whether the total size cap cut a patch or left one out. */
      readonly truncatedTotal: boolean
    }
