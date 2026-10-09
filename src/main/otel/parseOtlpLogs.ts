import { z } from 'zod'
import { isBoundedIdentifier } from '../../core/transcript/schemas/boundedIdentifier'
import { agentIdSchema, sessionIdSchema } from '../../shared/ipc/requestSchemas'
import {
  collectOtlpAttributes,
  readOtlpNumber,
  readOtlpString,
  type OtlpAttributes
} from './otlpAttributes'

/** The most log records read from one request; later ones are ignored. */
export const MAX_OTLP_RECORDS = 5000

/** One Claude Code API request, as its `claude_code.api_request` log event reported it. */
export interface ReportedApiRequest {
  /** The session the request belongs to. */
  readonly sessionId: string
  /** Claude Code's own cost estimate for the request, in USD. */
  readonly costUsd: number
  /** Input tokens. */
  readonly inputTokens: number
  /** Output tokens. */
  readonly outputTokens: number
  /** Tokens read from the prompt cache; 0 when not reported. */
  readonly cacheReadTokens: number
  /** Tokens written to the prompt cache; 0 when not reported. */
  readonly cacheCreationTokens: number
  /** The model id, or `null` when absent or unusable. */
  readonly model: string | null
  /** The subagent that made the request, or `null` for the lead. */
  readonly agentId: string | null
  /** The request id used to drop a retried export, or `null` when absent or unusable. */
  readonly requestId: string | null
}

/** The outcome of parsing a request body. */
export type ParseOtlpLogsResult =
  | { readonly ok: true; readonly value: readonly ReportedApiRequest[] }
  | { readonly ok: false; readonly error: 'malformed' }

const EVENT_NAMES: ReadonlySet<string> = new Set(['claude_code.api_request', 'api_request'])

const TOKEN_KEYS = [
  'input_tokens',
  'output_tokens',
  'cache_read_tokens',
  'cache_creation_tokens'
] as const

/** The only attributes ever read. Anything else, such as prompt text, is dropped unread. */
const WANTED_ATTRIBUTES: ReadonlySet<string> = new Set([
  'event.name',
  'session.id',
  'cost_usd',
  'model',
  'agent_id',
  'request_id',
  ...TOKEN_KEYS
])

const requestSchema = z.object({ resourceLogs: z.array(z.unknown()) })

const resourceLogsSchema = z.object({
  resource: z.object({ attributes: z.unknown() }).optional().catch(undefined),
  scopeLogs: z.array(z.unknown()).catch([])
})

const scopeLogsSchema = z.object({ logRecords: z.array(z.unknown()).catch([]) })

const logRecordSchema = z.object({
  attributes: z.unknown(),
  eventName: z.string().optional().catch(undefined),
  body: z
    .object({ stringValue: z.string().optional().catch(undefined) })
    .optional()
    .catch(undefined)
})

type LogRecord = z.infer<typeof logRecordSchema>

/** A token count: a non-negative integer, 0 when absent, `undefined` when present but unusable. */
function readCount(attributes: OtlpAttributes, key: string): number | undefined {
  const value = attributes.get(key)
  if (value === undefined) return 0
  const count = readOtlpNumber(value)
  return count !== undefined && Number.isSafeInteger(count) && count >= 0 ? count : undefined
}

/** An optional identifier: `null` when absent, `undefined` when present but unusable. */
function readOptionalIdentifier(
  attributes: OtlpAttributes,
  key: string
): string | null | undefined {
  const text = readOtlpString(attributes.get(key))
  if (text === undefined) return null
  return text.length > 0 && isBoundedIdentifier(text) ? text : undefined
}

function isApiRequest(record: LogRecord, attributes: OtlpAttributes): boolean {
  const names = [
    record.eventName,
    readOtlpString(attributes.get('event.name')),
    record.body?.stringValue
  ]
  return names.some((name) => name !== undefined && EVENT_NAMES.has(name))
}

function toApiRequest(attributes: OtlpAttributes): ReportedApiRequest | null {
  const sessionId = sessionIdSchema.safeParse(readOtlpString(attributes.get('session.id')))
  const costUsd = readOtlpNumber(attributes.get('cost_usd'))
  const [inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens] = TOKEN_KEYS.map((key) =>
    readCount(attributes, key)
  )
  const rawAgentId = readOtlpString(attributes.get('agent_id'))
  const agentId = rawAgentId === undefined ? null : agentIdSchema.safeParse(rawAgentId)

  if (!sessionId.success || costUsd === undefined || costUsd < 0) return null
  if (
    inputTokens === undefined ||
    outputTokens === undefined ||
    cacheReadTokens === undefined ||
    cacheCreationTokens === undefined
  ) {
    return null
  }
  if (agentId !== null && !agentId.success) return null
  return {
    sessionId: sessionId.data,
    costUsd,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    model: readOptionalIdentifier(attributes, 'model') ?? null,
    agentId: agentId === null ? null : agentId.data,
    requestId: readOptionalIdentifier(attributes, 'request_id') ?? null
  }
}

/**
 * Extracts Claude Code's per-request cost reports from an OTLP/JSON logs body.
 *
 * Only `claude_code.api_request` events are kept, recognized by the record's
 * `eventName`, its `event.name` attribute, or its `body.stringValue`. Only the
 * session, cost, token, model, agent and request attributes are read, and
 * resource attributes sit under the record's own. A malformed or unusable
 * record is skipped without affecting the rest of the batch.
 *
 * @param body - The parsed JSON body of a `POST /v1/logs` request.
 * @returns The reported requests, or `malformed` when the body isn't an OTLP
 * logs request. Reads at most {@link MAX_OTLP_RECORDS} records, counting every
 * kind of event.
 */
export function parseOtlpLogs(body: unknown): ParseOtlpLogsResult {
  const request = requestSchema.safeParse(body)
  if (!request.success) return { ok: false, error: 'malformed' }

  const requests: ReportedApiRequest[] = []
  let seen = 0
  for (const resourceEntry of request.data.resourceLogs) {
    const resourceLogs = resourceLogsSchema.safeParse(resourceEntry)
    if (!resourceLogs.success) continue
    const resourceAttributes = collectOtlpAttributes(
      resourceLogs.data.resource?.attributes,
      WANTED_ATTRIBUTES
    )
    for (const scopeEntry of resourceLogs.data.scopeLogs) {
      const scopeLogs = scopeLogsSchema.safeParse(scopeEntry)
      if (!scopeLogs.success) continue
      for (const recordEntry of scopeLogs.data.logRecords) {
        if (seen >= MAX_OTLP_RECORDS) return { ok: true, value: requests }
        seen += 1
        const record = logRecordSchema.safeParse(recordEntry)
        if (!record.success) continue
        const attributes = new Map([
          ...resourceAttributes,
          ...collectOtlpAttributes(record.data.attributes, WANTED_ATTRIBUTES)
        ])
        if (!isApiRequest(record.data, attributes)) continue
        const apiRequest = toApiRequest(attributes)
        if (apiRequest !== null) requests.push(apiRequest)
      }
    }
  }
  return { ok: true, value: requests }
}
