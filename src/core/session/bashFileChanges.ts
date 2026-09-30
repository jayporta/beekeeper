import { isAbsolutePathWithinCap } from '../shared/boundedPath'
import { isRecordObject } from '../transcript/isRecordObject'
import { bashEditFileSchema, bashToolUseResultSchema } from '../transcript/schemas'

/**
 * The most changed paths one Bash result contributes. A real result names at
 * most a few dozen, so a longer list is a crafted or runaway one: the paths
 * past the cap are dropped, and the result counts as incomplete.
 */
export const MAX_BASH_CHANGED_FILES = 256

/** How a Bash command changed a file, as far as its result says. */
export type BashFileOperation = 'create' | 'update' | 'delete' | 'change'

/** One file a Bash command changed, and how. */
export interface BashFileChange {
  /** The changed file's absolute path. */
  readonly filePath: string
  /**
   * `create` or `delete` when the result's file entry says so, `update` when
   * the entry says neither (a modified file), and `change` when the result
   * has no entry for the path, so gave no detail on how it changed.
   */
  readonly operation: BashFileOperation
}

/** What one Bash result says about the files its command changed. */
export interface BashFileChanges {
  /** The changed files, in the order the result names them. */
  readonly changes: readonly BashFileChange[]
  /**
   * Whether the list may be missing files: the result said it could not tell
   * what changed (`unavailable`, `shared`, or `skipped`), named more than
   * {@link MAX_BASH_CHANGED_FILES} paths, named a path that was dropped for
   * not being an absolute path within the path cap, gave no usable
   * `changedFiles` (missing, not an array, or with no usable path), so the
   * list is at most what its file entries name, or carried a `bashEditDiff`
   * that is not an object, so the list is empty. Not set by `moreFiles`,
   * which truncates only the hunks: `changedFiles` still names every path.
   * Not set by a path repeated in `changedFiles`, which is listed once.
   */
  readonly incomplete: boolean
}

/** A `files` entry the result gave detail for, keyed by its path. */
interface FileEntry {
  readonly filePath: string
  readonly operation: 'create' | 'update' | 'delete'
}

/** The usable entries of the result's `files`, in order, within the cap. */
function fileEntries(files: readonly unknown[]): FileEntry[] {
  const entries: FileEntry[] = []
  for (const entry of files.slice(0, MAX_BASH_CHANGED_FILES)) {
    const parsed = bashEditFileSchema.safeParse(entry)
    if (!parsed.success) continue
    const { filePath, created, deleted } = parsed.data
    entries.push({
      filePath,
      operation: created === true ? 'create' : deleted === true ? 'delete' : 'update'
    })
  }
  return entries
}

/**
 * The distinct entries of `named`, first occurrence first, walking it only
 * until {@link MAX_BASH_CHANGED_FILES} + 1 are found. The extra one tells the
 * caller the list is over the cap. A list that repeats a few paths is walked
 * once in full, at about the cost of the `JSON.parse` that built it, and is
 * bounded by the transcript's line-length cap.
 */
function distinctPathsUpToCap(named: readonly unknown[]): unknown[] {
  const distinct = new Set<unknown>()
  for (const path of named) {
    distinct.add(path)
    if (distinct.size > MAX_BASH_CHANGED_FILES) break
  }
  return [...distinct]
}

/** Whether the result carries a `bashEditDiff` that is neither absent nor `null`, whatever its shape. */
function hasUnparsableDiff(rawResult: unknown): boolean {
  return isRecordObject(rawResult) && rawResult.bashEditDiff != null
}

/**
 * Reads the files a Bash call changed from its `toolUseResult`'s
 * `bashEditDiff`. A path repeated in `changedFiles` counts once, at its first
 * position, before any cap applies; a repeat alone does not make the result
 * incomplete. A path that isn't an absolute path within the path cap is
 * dropped, and the result counts as incomplete. When `changedFiles` is
 * missing or isn't an array, the paths of the usable `files` entries stand in
 * for it. A result whose `changedFiles` is unusable, or yields no path,
 * counts as incomplete, so a diff with nothing usable never reads as a
 * complete list of no files. A `bashEditDiff` that is present but not an
 * object reads as an incomplete list of no files. Hunks are never read.
 *
 * @param rawResult - The user record's top-level `toolUseResult`, unvalidated.
 * @returns The changes, or `null` when the result has no `bashEditDiff` or
 * it is `null`, as for a Bash call that changed no tracked file.
 */
export function readBashFileChanges(rawResult: unknown): BashFileChanges | null {
  const result = bashToolUseResultSchema.safeParse(rawResult)
  const diff = result.success ? result.data.bashEditDiff : undefined
  if (diff === undefined) {
    return hasUnparsableDiff(rawResult) ? { changes: [], incomplete: true } : null
  }

  const entries = fileEntries(diff.files ?? [])
  const operations = new Map(entries.map((entry) => [entry.filePath, entry.operation]))
  const namedPaths = distinctPathsUpToCap(
    diff.changedFiles ?? entries.map((entry) => entry.filePath)
  )

  const changes: BashFileChange[] = []
  let dropped = false
  for (const filePath of namedPaths.slice(0, MAX_BASH_CHANGED_FILES)) {
    if (!isAbsolutePathWithinCap(filePath)) {
      dropped = true
      continue
    }
    changes.push({ filePath, operation: operations.get(filePath) ?? 'change' })
  }

  const unknown = diff.unavailable === true || diff.shared === true || diff.skipped === true
  const overCap = namedPaths.length > MAX_BASH_CHANGED_FILES
  const unusableNames = diff.changedFiles === undefined || changes.length === 0
  return { changes, incomplete: unknown || dropped || overCap || unusableNames }
}
