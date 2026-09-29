import { messageContentBlocks } from '../transcript/messageContentBlocks'
import {
  editToolUseResultSchema,
  toolUseBlockSchema,
  writeToolUseResultSchema
} from '../transcript/schemas'
import { parseSoleToolResultBlock } from '../transcript/soleToolResultBlock'
import { readBashFileChanges } from './bashFileChanges'

/** Tool names whose result the collector turns into file touches. */
const TRACKED_TOOL_NAMES = new Set(['Edit', 'Write', 'Bash'])

/**
 * The most Bash touches one transcript contributes, and also the most
 * incomplete results it reports. Each Bash result is capped on its own (see
 * `MAX_BASH_CHANGED_FILES`), but a transcript can hold any number of them, so
 * without a total a crafted one could make millions of touches. Real
 * transcripts name a few hundred files at most. Past the cap, further Bash
 * touches are not added and each result that lost some marks the agent's list
 * incomplete.
 */
export const MAX_BASH_TOUCHES_PER_TRANSCRIPT = 4096

/** How one tool call changed a file, as reported by its transcript record. */
export interface FileTouch {
  /** The changed file's path, as the tool reported it. */
  readonly filePath: string
  /**
   * What the tool did to the file. `change` is a Bash result's path with no
   * file entry: changed, but the result gave no detail on how.
   */
  readonly operation: 'edit' | 'create' | 'update' | 'delete' | 'change'
  /** Which kind of call reported it: an `Edit`/`Write` call, or a Bash command's detected changes. */
  readonly source: 'edit-write' | 'bash'
  /** The `tool_use_id` that produced this touch, used to dedupe across transcripts. */
  readonly toolUseId: string
}

/** Collects file touches from one transcript's records, in a single pass. */
export interface FileTouchCollector {
  /** Feeds one parsed record to the collector. Records must be observed in file order. */
  observe(record: Record<string, unknown>): void
  /** Every file touch collected so far, in the order observed. */
  touches(): readonly FileTouch[]
  /**
   * The `tool_use_id` of every Bash result so far whose changed-file list may
   * be missing files (see `BashFileChanges`), in the order observed.
   */
  incompleteToolUseIds(): readonly string[]
  /**
   * Whether an incomplete result arrived after {@link incompleteToolUseIds}
   * was full, so its id was not kept. The transcript's agent must then be
   * treated as incomplete outright, since the id could not be matched against
   * a fork's copy.
   */
  incompleteOverflowed(): boolean
}

/**
 * Creates a collector that turns a transcript's `Edit`/`Write` tool calls and
 * the file changes a Bash result reports into file touches, reading the same
 * records `collectAgentReports` already reads so the transcript is scanned
 * only once.
 *
 * An assistant record's `tool_use` content blocks are remembered by id, so
 * a later `tool_result` can be matched back to the tool that produced it;
 * only `Edit`/`Write`/`Bash` calls are remembered, and each until its result
 * arrives, so the map doesn't grow with every `Read` or `Grep` call in the
 * transcript. A user record counts only when it holds exactly one
 * `tool_result` block, since more than one would make the matching tool name
 * ambiguous. A `tool_result` with no earlier tracked `tool_use` is ignored,
 * and so is a `toolUseResult` that isn't an object, since a string result
 * there means the call failed and never touched a file. A Bash result adds
 * touches only when it carries a `bashEditDiff`.
 *
 * @returns A collector ready to `observe` a transcript's records in order.
 */
export function createFileTouchCollector(): FileTouchCollector {
  const toolNameByUseId = new Map<string, string>()
  const touches: FileTouch[] = []
  const incompleteToolUseIds: string[] = []
  let bashTouchCount = 0
  let incompleteOverflowed = false

  function observeToolUse(record: Record<string, unknown>): void {
    for (const block of messageContentBlocks(record)) {
      const parsed = toolUseBlockSchema.safeParse(block)
      if (parsed.success && TRACKED_TOOL_NAMES.has(parsed.data.name)) {
        toolNameByUseId.set(parsed.data.id, parsed.data.name)
      }
    }
  }

  function observeToolResult(record: Record<string, unknown>): void {
    const matched = parseSoleToolResultBlock(messageContentBlocks(record))
    if (matched === null) return

    const toolName = toolNameByUseId.get(matched.tool_use_id)
    if (toolName === undefined) return
    toolNameByUseId.delete(matched.tool_use_id)

    if (toolName === 'Bash') {
      observeBashResult({ rawResult: record.toolUseResult, toolUseId: matched.tool_use_id })
      return
    }
    const touch = buildFileTouch({
      toolName,
      rawResult: record.toolUseResult,
      toolUseId: matched.tool_use_id
    })
    if (touch) touches.push(touch)
  }

  function observeBashResult(input: { rawResult: unknown; toolUseId: string }): void {
    const changes = readBashFileChanges(input.rawResult)
    if (changes === null) return
    let overflowed = false
    for (const change of changes.changes) {
      if (bashTouchCount >= MAX_BASH_TOUCHES_PER_TRANSCRIPT) {
        overflowed = true
        break
      }
      bashTouchCount += 1
      touches.push({
        filePath: change.filePath,
        operation: change.operation,
        source: 'bash',
        toolUseId: input.toolUseId
      })
    }
    if (changes.incomplete || overflowed) markIncomplete(input.toolUseId)
  }

  function markIncomplete(toolUseId: string): void {
    if (incompleteToolUseIds.length < MAX_BASH_TOUCHES_PER_TRANSCRIPT) {
      incompleteToolUseIds.push(toolUseId)
    } else {
      incompleteOverflowed = true
    }
  }

  return {
    observe(record) {
      if (record.type === 'assistant') observeToolUse(record)
      else if (record.type === 'user') observeToolResult(record)
    },
    touches: () => touches,
    incompleteToolUseIds: () => incompleteToolUseIds,
    incompleteOverflowed: () => incompleteOverflowed
  }
}

/** Input for {@link buildFileTouch}. */
interface BuildFileTouchInput {
  /** The tool name a matching `tool_use` block reported. */
  readonly toolName: string
  /** The user record's top-level `toolUseResult`, unvalidated. */
  readonly rawResult: unknown
  /** The `tool_use_id` shared by the `tool_use` and `tool_result` blocks. */
  readonly toolUseId: string
}

/**
 * Validates one tracked tool's result into a {@link FileTouch}.
 * @param input - The tool name, its raw result, and the shared tool use id.
 * @returns The touch, or `null` when the result isn't a validating object
 * for that tool.
 */
function buildFileTouch(input: BuildFileTouchInput): FileTouch | null {
  const { toolName, rawResult, toolUseId } = input
  if (typeof rawResult !== 'object' || rawResult === null) return null

  if (toolName === 'Edit') {
    const edit = editToolUseResultSchema.safeParse(rawResult)
    return edit.success
      ? { filePath: edit.data.filePath, operation: 'edit', source: 'edit-write', toolUseId }
      : null
  }

  const write = writeToolUseResultSchema.safeParse(rawResult)
  return write.success
    ? { filePath: write.data.filePath, operation: write.data.type, source: 'edit-write', toolUseId }
    : null
}
