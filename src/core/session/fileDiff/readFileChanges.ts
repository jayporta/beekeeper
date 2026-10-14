import { isRecordObject } from '../../transcript/isRecordObject'
import { messageContentBlocks } from '../../transcript/messageContentBlocks'
import { readRecords } from '../../transcript/readRecords'
import { parseSoleToolResultBlock } from '../../transcript/soleToolResultBlock'
import { bashToolUseResultSchema } from '../../transcript/schemas'
import { MAX_BASH_CHANGED_FILES } from '../bashFileChanges'
import {
  MAX_FILE_DIFF_CHARS,
  type FileChange,
  type FileChanges,
  type FileDiffHunk
} from './fileChange'
import { bashHunkEntrySchema, createResultSchema, patchResultSchema } from './structuredPatchSchema'

/** Options for {@link readFileChanges}. */
export interface ReadFileChangesOptions {
  /** Absolute path of the agent's transcript. */
  readonly transcriptPath: string
  /** The tool use ids (Edit, Write and Bash) the agent owns for the file. */
  readonly toolUseIds: ReadonlySet<string>
  /** The file; an Edit/Write result must name it, and a Bash result's `files[]` entry must match it exactly. */
  readonly filePath: string
}

/** What is left of the size cap while a transcript is read. */
interface Budget {
  remaining: number
  truncated: boolean
}

/** Keeps the lines of `hunks` that fit `budget`, dropping every hunk left empty by the cut. */
function capHunks(hunks: readonly FileDiffHunk[], budget: Budget): FileDiffHunk[] {
  const kept: FileDiffHunk[] = []
  for (const hunk of hunks) {
    if (budget.truncated) break
    const lines: string[] = []
    for (const line of hunk.lines) {
      if (line.length > budget.remaining) {
        budget.truncated = true
        break
      }
      budget.remaining -= line.length
      lines.push(line)
    }
    if (lines.length === hunk.lines.length) kept.push(hunk)
    else if (lines.length > 0) kept.push({ ...hunk, lines })
  }
  return kept
}

/**
 * The added lines of a created file as one hunk, each prefixed `+`. Walks
 * `content` line by line and stops at the budget, so a huge file never builds
 * every line.
 */
function createdFileHunks(content: string, budget: Budget): FileDiffHunk[] {
  const lines: string[] = []
  let start = 0
  while (start < content.length) {
    const end = content.indexOf('\n', start)
    const line = `+${content.slice(start, end === -1 ? content.length : end)}`
    if (line.length > budget.remaining) {
      budget.truncated = true
      break
    }
    budget.remaining -= line.length
    lines.push(line)
    if (end === -1) break
    start = end + 1
  }
  if (lines.length === 0) return []
  return [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: lines.length, lines }]
}

/** The change an Edit or Write result recorded for the file. */
function readEditWriteChange(
  result: Record<string, unknown>,
  filePath: string,
  budget: Budget
): FileChange {
  if (result.filePath !== filePath) return { kind: 'unrecorded' }
  const created = createResultSchema.safeParse(result)
  if (created.success) {
    return {
      kind: 'patch',
      hunks: createdFileHunks(created.data.content, budget),
      userModified: created.data.userModified ?? false,
      shared: false
    }
  }
  const patch = patchResultSchema.safeParse(result)
  if (!patch.success) return { kind: 'unrecorded' }
  return {
    kind: 'patch',
    hunks: capHunks(patch.data.structuredPatch, budget),
    userModified: patch.data.userModified ?? false,
    shared: false
  }
}

/** The change a Bash result's `bashEditDiff` recorded for the file. */
function readBashChange(result: unknown, filePath: string, budget: Budget): FileChange {
  const diff = bashToolUseResultSchema.safeParse(result).data?.bashEditDiff
  if (diff?.files === undefined) return { kind: 'unrecorded' }
  for (const raw of diff.files.slice(0, MAX_BASH_CHANGED_FILES)) {
    const entry = bashHunkEntrySchema.safeParse(raw)
    if (!entry.success || entry.data.filePath !== filePath || entry.data.hunks.length === 0) {
      continue
    }
    return {
      kind: 'patch',
      hunks: capHunks(entry.data.hunks, budget),
      userModified: false,
      shared: diff.shared === true || diff.unavailable === true || diff.skipped === true
    }
  }
  return { kind: 'unrecorded' }
}

/** Input for {@link readChange}. */
interface ReadChangeInput {
  /** The record's top-level `toolUseResult`, unvalidated. */
  readonly result: unknown
  /** The file the change must be for. */
  readonly filePath: string
  /** What is left of the size cap. */
  readonly budget: Budget
}

/** Reads one result as an Edit/Write result when it names a file, else as a Bash result. */
function readChange(input: ReadChangeInput): FileChange {
  const { result, filePath, budget } = input
  if (!isRecordObject(result)) return { kind: 'unrecorded' }
  return 'filePath' in result
    ? readEditWriteChange(result, filePath, budget)
    : readBashChange(result, filePath, budget)
}

/**
 * Streams one transcript and reads the change each requested Edit, Write or
 * Bash call recorded for a file, from the patches in the calls' own results.
 * Stops reading once every requested id has a result.
 *
 * @remarks
 * Only a `user` record holding exactly one `tool_result` counts, and the
 * first result for an id wins. A Write that created the file is turned into
 * one hunk of added lines, since Claude Code records no patch for it. The
 * lines of all changes together are cut at {@link MAX_FILE_DIFF_CHARS}; a
 * change cut to nothing stays a `patch` with no hunks.
 *
 * @param options - The transcript, the tool use ids to read, and the file.
 * @returns The change for each id that had a result, and whether the cap cut any.
 * @throws {Error} When the transcript cannot be read.
 */
export async function readFileChanges(options: ReadFileChangesOptions): Promise<FileChanges> {
  const { transcriptPath, toolUseIds, filePath } = options
  const byToolUseId = new Map<string, FileChange>()
  const budget: Budget = { remaining: MAX_FILE_DIFF_CHARS, truncated: false }

  for await (const line of readRecords(transcriptPath)) {
    if (!line.ok || line.value.type !== 'user') continue
    const matched = parseSoleToolResultBlock(messageContentBlocks(line.value))
    const id = matched?.tool_use_id
    if (id === undefined || !toolUseIds.has(id) || byToolUseId.has(id)) continue

    byToolUseId.set(id, readChange({ result: line.value.toolUseResult, filePath, budget }))
    if (byToolUseId.size === toolUseIds.size) break
  }
  return { byToolUseId, truncated: budget.truncated }
}
