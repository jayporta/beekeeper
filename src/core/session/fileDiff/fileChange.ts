/** One hunk of a recorded patch, as Claude Code's `structuredPatch` holds it. */
export interface FileDiffHunk {
  /** The first line of the hunk in the old file. */
  readonly oldStart: number
  /** How many old-file lines the hunk spans. */
  readonly oldLines: number
  /** The first line of the hunk in the new file. */
  readonly newStart: number
  /** How many new-file lines the hunk spans. */
  readonly newLines: number
  /** Each line with its leading ' ', '+' or '-' marker, no newline. Untrusted text. */
  readonly lines: readonly string[]
}

/** What one Edit, Write or Bash call recorded about the file. */
export type FileChange =
  | {
      readonly kind: 'patch'
      /** The recorded hunks, cut at the size cap. */
      readonly hunks: readonly FileDiffHunk[]
      /** Whether the person edited the change before accepting it. */
      readonly userModified: boolean
      /** A Bash result flagged shared, unavailable or skipped: the hunks may include changes made outside the command. */
      readonly shared: boolean
      /** Whether the size cap removed any of this change's lines or hunks. */
      readonly cut: boolean
    }
  | { readonly kind: 'unrecorded' }

/** The most UTF-16 code units of hunk lines one diff carries before it is cut. */
export const MAX_FILE_DIFF_CHARS = 512 * 1024

/**
 * The weight, in UTF-16 code units, charged against {@link MAX_FILE_DIFF_CHARS}
 * for each kept hunk and each kept line beyond its text. Covers the object or
 * array entry and its header, so a patch of many empty hunks or empty lines
 * still reaches the cap.
 */
export const FILE_DIFF_ENTRY_OVERHEAD = 64

/** The changes read for the requested calls, by tool use id, and whether the cap cut any. */
export interface FileChanges {
  /** The change each found tool use id recorded. */
  readonly byToolUseId: ReadonlyMap<string, FileChange>
  /**
   * Whether {@link MAX_FILE_DIFF_CHARS} cut any change's lines, or dropped
   * whole hunks. Reading stops
   * at the cut, so an id with no entry then was not reached rather than
   * unrecorded.
   */
  readonly truncated: boolean
}
