/**
 * Synthetic JSONL fixtures for the transcript module's tests. Never derived
 * from or copied out of a real `~/.claude` transcript.
 */

/** Serializes one record as a single JSONL line, with no trailing newline. */
export function toJsonlLine(record: unknown): string {
  return JSON.stringify(record)
}

/** Joins records into JSONL text, each on its own line, ending in `\n`. */
export function buildJsonlText(records: readonly unknown[]): string {
  return records.map(toJsonlLine).join('\n') + '\n'
}

/**
 * Joins records into JSONL text followed by a partial, unterminated line,
 * as a live file caught mid-write would look.
 */
export function buildJsonlTextWithPartialLastLine(
  records: readonly unknown[],
  partialLine: string
): string {
  return buildJsonlText(records) + partialLine
}

interface AssistantRecordOverrides {
  readonly messageId?: string
  readonly outputTokens?: number
  readonly inputTokens?: number
  readonly parentUuid?: string | null
  readonly timestamp?: string
  readonly model?: string
  /** Merged onto the built `message.usage` object, e.g. to set `speed`, `iterations`, or cache fields. */
  readonly usageExtra?: Record<string, unknown>
  readonly extra?: Record<string, unknown>
}

/** Builds one synthetic `assistant` record. */
export function buildAssistantRecord(
  overrides: AssistantRecordOverrides = {}
): Record<string, unknown> {
  const {
    messageId = 'msg_1',
    outputTokens = 10,
    inputTokens = 5,
    parentUuid = 'parent-uuid-1',
    timestamp = '2026-01-01T00:00:00.000Z',
    model = 'claude-opus-5',
    usageExtra = {},
    extra = {}
  } = overrides

  return {
    type: 'assistant',
    timestamp,
    parentUuid,
    message: {
      id: messageId,
      model,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, ...usageExtra }
    },
    ...extra
  }
}

/** Builds a synthetic `agent-setting` record, as a teammate agent's transcript begins with. */
export function buildAgentSettingRecord(
  agentSetting: unknown = 'general-purpose'
): Record<string, unknown> {
  return { type: 'agent-setting', agentSetting }
}

interface UserRecordOverrides {
  /** Merged onto the built record as top-level fields, e.g. to set `agentName` or `teamName`. */
  readonly extra?: Record<string, unknown>
}

/** Builds a minimal synthetic `user` record. */
export function buildUserRecord(overrides: UserRecordOverrides = {}): Record<string, unknown> {
  const { extra = {} } = overrides

  return {
    type: 'user',
    timestamp: '2026-01-01T00:00:00.000Z',
    message: { role: 'user', content: 'hello' },
    ...extra
  }
}

/**
 * Builds two `assistant` records sharing one `message.id`, as one API
 * response split across lines, with `output_tokens` growing on the second.
 */
export function buildSplitAssistantRecords(
  messageId = 'msg_split'
): [Record<string, unknown>, Record<string, unknown>] {
  return [
    buildAssistantRecord({ messageId, outputTokens: 12 }),
    buildAssistantRecord({ messageId, outputTokens: 47 })
  ]
}

/** Builds an `assistant` record whose usage carries several iterations. */
export function buildAssistantRecordWithIterations(): Record<string, unknown> {
  return {
    type: 'assistant',
    timestamp: '2026-01-01T00:00:00.000Z',
    parentUuid: 'parent-uuid-1',
    message: {
      id: 'msg_iterations',
      model: 'claude-opus-5',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        iterations: [
          { input_tokens: 40, output_tokens: 20 },
          { input_tokens: 60, output_tokens: 30 }
        ]
      }
    }
  }
}

/** Builds an `assistant` record with unrelated, unknown extra fields (schema drift). */
export function buildAssistantRecordWithUnknownFields(): Record<string, unknown> {
  return buildAssistantRecord({ extra: { futureField: 'unreleased', nested: { newer: true } } })
}

/** Builds a record of a type this schema set has never seen. */
export function buildUnknownTypeRecord(): Record<string, unknown> {
  return { type: 'some-future-record-type', payload: { anything: 'goes' } }
}

/** Builds a synthetic `fork-context-ref` record. */
export function buildForkContextRefRecord(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    type: 'fork-context-ref',
    parentSessionId: 'session-parent-1',
    parentLastUuid: 'uuid-last-1',
    contextLength: 4096,
    ...overrides
  }
}

/** Builds a synthetic `cost-state` record with a raw, bracketed model id. */
export function buildCostStateRecord(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    type: 'cost-state',
    modelUsage: {
      'claude-opus-5[1m]': {
        inputTokens: 200,
        outputTokens: 80,
        cacheReadInputTokens: 10,
        cacheCreationInputTokens: 5,
        costUSD: 1.23
      }
    },
    totalCostUSD: 1.23,
    ...overrides
  }
}

/** Builds a synthetic `ai-title` record. */
export function buildAiTitleRecord(aiTitle = 'Fix the flaky test'): Record<string, unknown> {
  return { type: 'ai-title', aiTitle }
}

/** Builds a synthetic subagent `.meta.json` object with only the required field. */
export function buildMinimalSubagentMeta(agentType = 'general-purpose'): Record<string, unknown> {
  return { agentType }
}

interface SubagentMetaOverrides {
  readonly agentType?: string
  readonly parentAgentId?: string
  readonly teamName?: string
  readonly extra?: Record<string, unknown>
}

/** Builds a synthetic subagent `.meta.json` object with overridable fields. */
export function buildSubagentMeta(overrides: SubagentMetaOverrides = {}): Record<string, unknown> {
  const { agentType = 'general-purpose', parentAgentId, teamName, extra = {} } = overrides

  return {
    agentType,
    ...(parentAgentId !== undefined && { parentAgentId }),
    ...(teamName !== undefined && { teamName }),
    ...extra
  }
}

/** A short line of text with multi-byte UTF-8 characters, for chunk-boundary decoding tests. */
export const MULTIBYTE_TEXT = 'héllo 🐝 wörld'
