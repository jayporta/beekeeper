import type { NumstatEntryDto } from '../../../../../shared/ipc/worktreeDiffDto'

/** The totals of a diff. */
export interface NumstatSummary {
  /** Lines added across every file. */
  readonly added: number
  /** Lines deleted across every file. */
  readonly deleted: number
  /** How many files changed, binary files included. */
  readonly files: number
}

/**
 * Totals a diff's changed files. A binary file counts as a file and adds no
 * lines, since git reports no line counts for it.
 *
 * @param files - The changed files with their line counts.
 * @returns The lines added and deleted, and the number of files.
 */
export function summarizeNumstat(files: readonly NumstatEntryDto[]): NumstatSummary {
  let added = 0
  let deleted = 0
  for (const file of files) {
    added += file.added ?? 0
    deleted += file.deleted ?? 0
  }
  return { added, deleted, files: files.length }
}
