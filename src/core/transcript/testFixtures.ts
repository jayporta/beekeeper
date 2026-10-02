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
    timestamp = '2026-01-01T00:00:00.000Z',
    model = 'claude-opus-5',
    usageExtra = {},
    extra = {}
  } = overrides

  return {
    type: 'assistant',
    timestamp,
    parentUuid: 'parent-uuid-1',
    message: {
      id: messageId,
      model,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, ...usageExtra }
    },
    ...extra
  }
}

/** Options for {@link buildQuotaRejectionRecord}. */
interface QuotaRejectionOptions {
  /** The `quotaLimits.rateLimitType`. Defaults to `seven_day`. */
  readonly rateLimitType?: unknown
  /** The `quotaLimits.resetsAt`, in epoch seconds. Defaults to 2026-01-08T00:00:00Z. */
  readonly resetsAt?: unknown
  /** The `quotaLimits.status`. Defaults to `rejected`. */
  readonly status?: unknown
  /** The record's timestamp. Defaults to 2026-01-01T00:00:00.000Z. */
  readonly timestamp?: string
}

/**
 * Builds a synthetic assistant API-error record for a request rejected by a
 * plan limit, shaped like the one Claude Code writes, with an unknown extra
 * field in `quotaLimits` to stand in for the ones Beekeeper ignores.
 */
export function buildQuotaRejectionRecord(
  options: QuotaRejectionOptions = {}
): Record<string, unknown> {
  const {
    rateLimitType = 'seven_day',
    resetsAt = Date.parse('2026-01-08T00:00:00Z') / 1000,
    status = 'rejected',
    timestamp = '2026-01-01T00:00:00.000Z'
  } = options
  return {
    type: 'assistant',
    timestamp,
    isApiErrorMessage: true,
    error: 'rate_limit',
    message: { id: 'msg_limit', model: '<synthetic>', content: [] },
    quotaLimits: { status, rateLimitType, resetsAt, overageStatus: 'rejected' }
  }
}

/** Builds a synthetic `agent-setting` record, as a teammate agent's transcript begins with. */
export function buildAgentSettingRecord(
  agentSetting: unknown = 'general-purpose'
): Record<string, unknown> {
  return { type: 'agent-setting', agentSetting }
}

/**
 * Builds a `text` content block.
 *
 * @param text - The block's text.
 * @returns A block of the form `{ type: 'text', text }`.
 */
export function buildTextBlock(text: string): Record<string, unknown> {
  return { type: 'text', text }
}

interface UserRecordOverrides {
  /** The message's `content`; defaults to a short prompt string. */
  readonly content?: unknown
  /** Merged onto the built record as top-level fields, e.g. to set `agentName` or `teamName`. */
  readonly extra?: Record<string, unknown>
}

/** Builds a minimal synthetic `user` record. */
export function buildUserRecord(overrides: UserRecordOverrides = {}): Record<string, unknown> {
  const { content = 'hello', extra = {} } = overrides

  return {
    type: 'user',
    timestamp: '2026-01-01T00:00:00.000Z',
    message: { role: 'user', content },
    ...extra
  }
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
  readonly extra?: Record<string, unknown>
}

/** Builds a synthetic subagent `.meta.json` object with overridable fields. */
export function buildSubagentMeta(overrides: SubagentMetaOverrides = {}): Record<string, unknown> {
  const { agentType = 'general-purpose', parentAgentId, extra = {} } = overrides

  return {
    agentType,
    ...(parentAgentId !== undefined && { parentAgentId }),
    ...extra
  }
}

/** A short line of text with multi-byte UTF-8 characters, for chunk-boundary decoding tests. */
export const MULTIBYTE_TEXT = 'héllo 🐝 wörld'
