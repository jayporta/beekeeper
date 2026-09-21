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
}

/** Builds an `assistant` record whose content invokes one tool. */
export function buildAssistantToolUseRecord(
  overrides: AssistantToolUseRecordOverrides = {}
): Record<string, unknown> {
  const { messageId = 'msg_tool', toolUseId = 'toolu_1', toolName = 'Edit' } = overrides

  return {
    type: 'assistant',
    timestamp: '2026-01-01T00:00:00.000Z',
    message: {
      id: messageId,
      model: 'claude-opus-5',
      usage: { input_tokens: 1, output_tokens: 1 },
      content: [buildToolUseBlock({ id: toolUseId, name: toolName })]
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
  /** The record's top-level `toolUseResult`, omitted when not given. */
  readonly toolUseResult?: unknown
}

/** Builds a synthetic `user` record reporting a tool's result. */
export function buildUserToolResultRecord(
  overrides: UserToolResultRecordOverrides = {}
): Record<string, unknown> {
  const { toolUseId = 'toolu_1', toolUseResult } = overrides
  const contentBlocks = overrides.contentBlocks ?? [
    buildToolResultBlock({ tool_use_id: toolUseId })
  ]

  return {
    type: 'user',
    message: { role: 'user', content: contentBlocks },
    ...(toolUseResult !== undefined && { toolUseResult })
  }
}

/** Builds a synthetic `Edit` tool call's `toolUseResult`. */
export function buildEditToolUseResult(filePath = '/repo/src/example.ts'): Record<string, unknown> {
  return { filePath, oldString: 'a', newString: 'b' }
}

/** Builds a synthetic `Write` tool call's `toolUseResult`. */
export function buildWriteToolUseResult(
  filePath = '/repo/src/example.ts',
  type: 'create' | 'update' = 'create'
): Record<string, unknown> {
  return { filePath, type, content: 'contents' }
}
