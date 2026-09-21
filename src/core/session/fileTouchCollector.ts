import { messageContentBlocks } from '../transcript/messageContentBlocks'
import {
  editToolUseResultSchema,
  toolResultBlockSchema,
  toolUseBlockSchema,
  writeToolUseResultSchema,
  type ToolResultBlock
} from '../transcript/schemas'

/** Tool names whose result the collector turns into a file touch. */
const TRACKED_TOOL_NAMES = new Set(['Edit', 'Write'])

/** How one tool call changed a file, as reported by its transcript record. */
export interface FileTouch {
  /** The changed file's path, exactly as the tool reported it. */
  readonly filePath: string
  /** What the tool did to the file. */
  readonly operation: 'edit' | 'create' | 'update'
  /** The `tool_use_id` that produced this touch, used to dedupe across transcripts. */
  readonly toolUseId: string
}

/** Collects file touches from one transcript's records, in a single pass. */
export interface FileTouchCollector {
  /** Feeds one parsed record to the collector. Records must be observed in file order. */
  observe(record: Record<string, unknown>): void
  /** Every file touch collected so far, in the order observed. */
  touches(): readonly FileTouch[]
}

/**
 * Creates a collector that turns a transcript's `Edit`/`Write` tool calls
 * into file touches, reading the same records `collectAgentReports` already
 * reads so the transcript is scanned only once.
 *
 * An assistant record's `tool_use` content blocks are remembered by id, so
 * a later `tool_result` can be matched back to the tool that produced it;
 * only `Edit`/`Write` calls are remembered, so the map doesn't grow with
 * every `Bash`, `Read`, or `Grep` call in the transcript. A user record
 * counts only when it holds exactly one `tool_result` block (no transcript
 * record on disk holds more, and more than one would make the matching
 * tool name ambiguous). A `tool_result` with no earlier tracked `tool_use`
 * is ignored, and so is a `toolUseResult` that isn't an object, since a
 * string result there means the call failed and never touched a file.
 *
 * @returns A collector ready to `observe` a transcript's records in order.
 */
export function createFileTouchCollector(): FileTouchCollector {
  const toolNameByUseId = new Map<string, string>()
  const touches: FileTouch[] = []

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

    const touch = buildFileTouch({
      toolName,
      rawResult: record.toolUseResult,
      toolUseId: matched.tool_use_id
    })
    if (touch) touches.push(touch)
  }

  return {
    observe(record) {
      if (record.type === 'assistant') observeToolUse(record)
      else if (record.type === 'user') observeToolResult(record)
    },
    touches: () => touches
  }
}

/**
 * Parses a user record's content blocks as `tool_result` blocks, each
 * exactly once, and returns the sole match.
 * @param blocks - The record's `message.content` blocks, unvalidated.
 * @returns The one parsed `tool_result` block, or `null` when none or more
 * than one of `blocks` validates as one.
 */
function parseSoleToolResultBlock(blocks: readonly unknown[]): ToolResultBlock | null {
  let matchCount = 0
  let matched: ToolResultBlock | null = null

  for (const block of blocks) {
    const parsed = toolResultBlockSchema.safeParse(block)
    if (!parsed.success) continue
    matchCount += 1
    matched = parsed.data
  }

  return matchCount === 1 ? matched : null
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
    return edit.success ? { filePath: edit.data.filePath, operation: 'edit', toolUseId } : null
  }

  const write = writeToolUseResultSchema.safeParse(rawResult)
  return write.success
    ? { filePath: write.data.filePath, operation: write.data.type, toolUseId }
    : null
}
