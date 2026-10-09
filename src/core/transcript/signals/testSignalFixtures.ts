/**
 * Synthetic transcript records for signal tests. Never derived from or copied
 * out of a real `~/.claude` transcript.
 */

const DEFAULT_TIMESTAMP = '2026-01-01T00:00:00.000Z'

interface ToolCallRecordOptions {
  /** The call's `tool_use` id. */
  readonly toolUseId: string
  /** The tool's name. */
  readonly tool: string
  /** The call's `input.command`, omitted when not given. */
  readonly command?: unknown
  /** The record's timestamp; defaults to a fixed instant. */
  readonly timestamp?: string
}

/** Builds an `assistant` record holding one `tool_use` block. */
export function buildToolCallRecord(options: ToolCallRecordOptions): Record<string, unknown> {
  const { toolUseId, tool, command, timestamp = DEFAULT_TIMESTAMP } = options
  const input = command === undefined ? {} : { command }
  return {
    type: 'assistant',
    timestamp,
    message: { content: [{ type: 'tool_use', id: toolUseId, name: tool, input }] }
  }
}

interface ToolResultRecordOptions {
  /** The `tool_use_id` the result answers. */
  readonly toolUseId: string
  /** The block's `is_error`, omitted when not given. */
  readonly isError?: unknown
  /** The record's timestamp; defaults to a fixed instant. */
  readonly timestamp?: string
}

/** Builds a `user` record holding one `tool_result` block. */
export function buildToolResultRecord(options: ToolResultRecordOptions): Record<string, unknown> {
  const { toolUseId, isError, timestamp = DEFAULT_TIMESTAMP } = options
  const block: Record<string, unknown> = {
    type: 'tool_result',
    tool_use_id: toolUseId,
    content: 'done'
  }
  if (isError !== undefined) block.is_error = isError
  return { type: 'user', timestamp, message: { content: [block] } }
}

interface SystemRecordOptions {
  /** The record's `subtype`. */
  readonly subtype: string
  /** The record's `uuid`. */
  readonly uuid: string
}

/** Builds a `system` record. */
export function buildSystemRecord(options: SystemRecordOptions): Record<string, unknown> {
  return {
    type: 'system',
    subtype: options.subtype,
    uuid: options.uuid,
    timestamp: DEFAULT_TIMESTAMP
  }
}
