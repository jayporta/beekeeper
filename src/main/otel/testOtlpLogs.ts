/** A synthetic OTLP/JSON attribute value, in any of the shapes an exporter may send. */
export type TestOtlpValue = Record<string, unknown>

/** A session id that passes `sessionIdSchema`. */
export const TEST_SESSION_ID = '11111111-2222-4333-8444-555555555555'

/** Builds an OTLP attribute list from `key: value` pairs, where a plain string becomes a `stringValue`. */
export function otlpAttributes(
  attributes: Readonly<Record<string, string | TestOtlpValue>>
): { key: string; value: TestOtlpValue }[] {
  return Object.entries(attributes).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? { stringValue: value } : value
  }))
}

/** The attributes of a well-formed `claude_code.api_request` log record. */
export function apiRequestAttributes(
  overrides: Readonly<Record<string, string | TestOtlpValue>> = {}
): Record<string, string | TestOtlpValue> {
  return {
    'event.name': 'api_request',
    'session.id': TEST_SESSION_ID,
    model: 'claude-test-model',
    cost_usd: { doubleValue: 0.25 },
    input_tokens: { intValue: '100' },
    output_tokens: { intValue: 50 },
    cache_read_tokens: { intValue: '10' },
    cache_creation_tokens: { intValue: '5' },
    ...overrides
  }
}

/** The attributes of a well-formed `api_request` record, minus the given keys. */
export function apiRequestAttributesWithout(
  ...keys: readonly string[]
): Record<string, string | TestOtlpValue> {
  return Object.fromEntries(
    Object.entries(apiRequestAttributes()).filter(([key]) => !keys.includes(key))
  )
}

/** Wraps log records, and optional resource attributes, in the OTLP `ExportLogsServiceRequest` JSON shape. */
export function otlpLogsBody(
  logRecords: readonly unknown[],
  resourceAttributes: Readonly<Record<string, string | TestOtlpValue>> = {}
): unknown {
  return {
    resourceLogs: [
      {
        resource: { attributes: otlpAttributes(resourceAttributes) },
        scopeLogs: [{ logRecords }]
      }
    ]
  }
}

/** A log record carrying the given attributes. */
export function logRecord(
  attributes: Readonly<Record<string, string | TestOtlpValue>>,
  extra: Readonly<Record<string, unknown>> = {}
): Record<string, unknown> {
  return { attributes: otlpAttributes(attributes), ...extra }
}
