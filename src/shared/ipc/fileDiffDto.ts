import type { FileTouchDto } from './agentDto'

/** One hunk of a recorded patch. */
export interface FileDiffHunkDto {
  /** The first line of the hunk in the old file. */
  readonly oldStart: number
  /** How many old-file lines the hunk spans. */
  readonly oldLines: number
  /** The first line of the hunk in the new file. */
  readonly newStart: number
  /** How many new-file lines the hunk spans. */
  readonly newLines: number
  /** Each line with its leading ' ', '+' or '-' marker. Render as plain text only. */
  readonly lines: readonly string[]
}

/** One recorded change to the file, in the order the agent made it. */
export type FileChangeDto =
  | {
      readonly kind: 'patch'
      /** Which kind of call made the change. */
      readonly source: FileTouchDto['source']
      /** What the call did to the file. */
      readonly operation: FileTouchDto['operation']
      /** The recorded hunks; none for an empty file or a change cut at the size cap. */
      readonly hunks: readonly FileDiffHunkDto[]
      /** Whether the person edited the change before accepting it. */
      readonly userModified: boolean
      /** A Bash diff flagged shared, unavailable or skipped: the hunks may include changes made outside the command. */
      readonly shared: boolean
    }
  | {
      readonly kind: 'unrecorded'
      /** Which kind of call made the change. */
      readonly source: FileTouchDto['source']
      /** What the call did to the file. */
      readonly operation: FileTouchDto['operation']
    }

/** What one agent changed in one file, from the patches its own tool results recorded. */
export interface FileDiffDto {
  /** The file's path as the tools reported it. Render as plain text only. */
  readonly filePath: string
  /** The agent's changes to the file, in order. */
  readonly changes: readonly FileChangeDto[]
  /** Whether the size cap cut some of the changes' lines. */
  readonly truncated: boolean
}
