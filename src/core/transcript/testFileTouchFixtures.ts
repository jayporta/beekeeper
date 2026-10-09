/**
 * Synthetic fixtures for file-touch tracking: `tool_use`/`tool_result`
 * content blocks and the `Edit`/`Write` `toolUseResult` shapes they pair
 * with. Never derived from or copied out of a real `~/.claude` transcript.
 */

/** Builds a synthetic assistant `tool_use` content block. */
export function buildToolUseBlock(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return { type: 'tool_use', id: 'toolu_1', name: 'Edit', input: {}, ...overrides }
}

interface AssistantToolUseRecordOverrides {
  readonly messageId?: string
  readonly toolUseId?: string
  readonly toolName?: string
  /** The `tool_use` block's `input`; defaults to an empty object. */
  readonly input?: unknown
  /** The record's timestamp; defaults to a fixed instant. */
  readonly timestamp?: string
}

/** Builds an `assistant` record whose content invokes one tool. */
export function buildAssistantToolUseRecord(
  overrides: AssistantToolUseRecordOverrides = {}
): Record<string, unknown> {
  const {
    messageId = 'msg_tool',
    toolUseId = 'toolu_1',
    toolName = 'Edit',
    input = {},
    timestamp = '2026-01-01T00:00:00.000Z'
  } = overrides

  return {
    type: 'assistant',
    timestamp,
    message: {
      id: messageId,
      model: 'claude-opus-5',
      usage: { input_tokens: 1, output_tokens: 1 },
      content: [buildToolUseBlock({ id: toolUseId, name: toolName, input })]
    }
  }
}

/** Builds a synthetic user `tool_result` content block. */
export function buildToolResultBlock(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return { type: 'tool_result', tool_use_id: 'toolu_1', content: 'done', ...overrides }
}

interface UserToolResultRecordOverrides {
  /** The content blocks to attach; defaults to one `tool_result` block for `toolUseId`. */
  readonly contentBlocks?: readonly Record<string, unknown>[]
  readonly toolUseId?: string
  /** The default block's `is_error`, omitted when not given. Unknown-typed so a test can pass a non-boolean. */
  readonly isError?: unknown
  /** The record's timestamp, omitted when not given. */
  readonly timestamp?: string
  /** The record's top-level `toolUseResult`, omitted when not given. */
  readonly toolUseResult?: unknown
}

/** Builds a synthetic `user` record reporting a tool's result. */
export function buildUserToolResultRecord(
  overrides: UserToolResultRecordOverrides = {}
): Record<string, unknown> {
  const { toolUseId = 'toolu_1', isError, timestamp, toolUseResult } = overrides
  const contentBlocks = overrides.contentBlocks ?? [
    buildToolResultBlock({
      tool_use_id: toolUseId,
      ...(isError !== undefined && { is_error: isError })
    })
  ]

  return {
    type: 'user',
    ...(timestamp !== undefined && { timestamp }),
    message: { role: 'user', content: contentBlocks },
    ...(toolUseResult !== undefined && { toolUseResult })
  }
}

/** Builds a synthetic `Edit` tool call's `toolUseResult`. */
export function buildEditToolUseResult(filePath = '/repo/src/example.ts'): Record<string, unknown> {
  return { filePath, oldString: 'a', newString: 'b' }
}

/**
 * Builds a synthetic Bash tool call's `toolUseResult`, carrying a
 * `bashEditDiff` when one is given.
 */
export function buildBashToolUseResult(
  bashEditDiff?: Record<string, unknown>
): Record<string, unknown> {
  return { stdout: 'ok', stderr: '', ...(bashEditDiff !== undefined && { bashEditDiff }) }
}

/** Builds a synthetic `Write` tool call's `toolUseResult`. */
export function buildWriteToolUseResult(
  filePath = '/repo/src/example.ts',
  type: 'create' | 'update' = 'create'
): Record<string, unknown> {
  return { filePath, type, content: 'contents' }
}
