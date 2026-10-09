import { describe, expect, it } from 'vitest'
import { MAX_OTLP_RECORDS, parseOtlpLogs, type ReportedApiRequest } from '../parseOtlpLogs'
import {
  apiRequestAttributes,
  apiRequestAttributesWithout,
  logRecord,
  otlpLogsBody,
  TEST_SESSION_ID,
  type TestOtlpValue
} from '../testOtlpLogs'

function parseRequests(
  records: readonly unknown[],
  resourceAttributes: Readonly<Record<string, string | TestOtlpValue>> = {}
): readonly ReportedApiRequest[] {
  const result = parseOtlpLogs(otlpLogsBody(records, resourceAttributes))
  if (!result.ok) throw new Error('expected the body to parse')
  return result.value
}

function oneRequest(
  overrides: Readonly<Record<string, string | TestOtlpValue>> = {}
): readonly ReportedApiRequest[] {
  return parseRequests([logRecord(apiRequestAttributes(overrides))])
}

describe('parseOtlpLogs', () => {
  it('extracts the fields of an api_request record', () => {
    expect(
      parseRequests([logRecord(apiRequestAttributes({ agent_id: 'abc123', request_id: 'req_1' }))])
    ).toEqual([
      {
        sessionId: TEST_SESSION_ID,
        costUsd: 0.25,
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 10,
        cacheCreationTokens: 5,
        model: 'claude-test-model',
        agentId: 'abc123',
        requestId: 'req_1'
      }
    ])
  })

  it('reads an intValue sent as a string and as a number', () => {
    const [request] = oneRequest({
      input_tokens: { intValue: '7' },
      output_tokens: { intValue: 8 }
    })

    expect([request?.inputTokens, request?.outputTokens]).toEqual([7, 8])
  })

  it('reads numeric fields from a doubleValue, an intValue, or a numeric stringValue', () => {
    const [request] = oneRequest({
      cost_usd: { stringValue: '0.5' },
      input_tokens: { doubleValue: 12 },
      output_tokens: { stringValue: '13' }
    })

    expect([request?.costUsd, request?.inputTokens, request?.outputTokens]).toEqual([0.5, 12, 13])
  })

  it('recognizes the event name by its claude_code.-prefixed form', () => {
    expect(oneRequest({ 'event.name': 'claude_code.api_request' })).toHaveLength(1)
  })

  it('recognizes the event name from the top-level eventName field', () => {
    const attributes = apiRequestAttributesWithout('event.name')
    const records = [logRecord(attributes, { eventName: 'claude_code.api_request' })]

    expect(parseRequests(records)).toHaveLength(1)
  })

  it('recognizes the event name from body.stringValue', () => {
    const attributes = apiRequestAttributesWithout('event.name')
    const records = [logRecord(attributes, { body: { stringValue: 'claude_code.api_request' } })]

    expect(parseRequests(records)).toHaveLength(1)
  })

  it('ignores records of other events', () => {
    expect(oneRequest({ 'event.name': 'tool_result' })).toEqual([])
  })

  it('ignores a record with no event name', () => {
    const attributes = apiRequestAttributesWithout('event.name')

    expect(parseRequests([logRecord(attributes)])).toEqual([])
  })

  it('treats missing token counts as 0', () => {
    const attributes = apiRequestAttributesWithout('cache_read_tokens', 'cache_creation_tokens')

    const [request] = parseRequests([logRecord(attributes)])

    expect([request?.cacheReadTokens, request?.cacheCreationTokens]).toEqual([0, 0])
  })

  it('drops a record whose session.id is not a session id', () => {
    expect(oneRequest({ 'session.id': 'not-a-uuid' })).toEqual([])
  })

  it('drops a record with no session.id', () => {
    const attributes = apiRequestAttributesWithout('session.id')

    expect(parseRequests([logRecord(attributes)])).toEqual([])
  })

  it('drops a record with a negative cost', () => {
    expect(oneRequest({ cost_usd: { doubleValue: -0.01 } })).toEqual([])
  })

  it('drops a record with a non-finite cost', () => {
    expect(oneRequest({ cost_usd: { stringValue: 'Infinity' } })).toEqual([])
  })

  it('drops a record whose cost overflowed to infinity in JSON', () => {
    const body = JSON.parse(
      '{"resourceLogs":[{"scopeLogs":[{"logRecords":[{"attributes":[' +
        '{"key":"event.name","value":{"stringValue":"api_request"}},' +
        `{"key":"session.id","value":{"stringValue":"${TEST_SESSION_ID}"}},` +
        '{"key":"cost_usd","value":{"doubleValue":1e999}}]}]}]}]}'
    ) as unknown

    expect(parseOtlpLogs(body)).toEqual({ ok: true, value: [] })
  })

  it('drops a record with no cost', () => {
    const attributes = apiRequestAttributesWithout('cost_usd')

    expect(parseRequests([logRecord(attributes)])).toEqual([])
  })

  it('drops a record with a negative token count', () => {
    expect(oneRequest({ input_tokens: { intValue: -1 } })).toEqual([])
  })

  it('drops a record with a fractional token count', () => {
    expect(oneRequest({ output_tokens: { doubleValue: 1.5 } })).toEqual([])
  })

  it('drops a record whose token count is not a number', () => {
    expect(oneRequest({ input_tokens: { stringValue: 'many' } })).toEqual([])
  })

  it('drops a record whose agent_id could be a path', () => {
    expect(oneRequest({ agent_id: '../etc' })).toEqual([])
  })

  it('reports no agent id and no request id when they are absent', () => {
    const [request] = oneRequest()

    expect([request?.agentId, request?.requestId]).toEqual([null, null])
  })

  it('reports no model when the model is unprintable', () => {
    const [request] = oneRequest({ model: 'evil‮model' })

    expect(request?.model).toBeNull()
  })

  it('reports no request id when it is unprintable', () => {
    const [request] = oneRequest({ request_id: 'bad\nid' })

    expect(request?.requestId).toBeNull()
  })

  it('lets a record attribute override the same resource attribute', () => {
    const attributes = apiRequestAttributesWithout('session.id')
    const otherSession = '99999999-2222-4333-8444-555555555555'

    const requests = parseRequests([logRecord({ ...attributes, 'session.id': TEST_SESSION_ID })], {
      'session.id': otherSession
    })

    expect(requests[0]?.sessionId).toBe(TEST_SESSION_ID)
  })

  it('takes the session id from the resource attributes when the record has none', () => {
    const attributes = apiRequestAttributesWithout('session.id')

    const requests = parseRequests([logRecord(attributes)], { 'session.id': TEST_SESSION_ID })

    expect(requests[0]?.sessionId).toBe(TEST_SESSION_ID)
  })

  it('keeps the valid records when another record in the batch is malformed', () => {
    const good = logRecord(apiRequestAttributes())

    expect(parseRequests([42, null, 'text', good, { attributes: 'nope' }])).toHaveLength(1)
  })

  it('reads records across several resources and scopes', () => {
    const record = logRecord(apiRequestAttributes())
    const body = {
      resourceLogs: [
        { scopeLogs: [{ logRecords: [record] }, { logRecords: [record] }] },
        { scopeLogs: [{ logRecords: [record] }] }
      ]
    }

    const result = parseOtlpLogs(body)

    expect(result.ok && result.value.length).toBe(3)
  })

  it('ignores records past the per-request cap', () => {
    const record = logRecord(apiRequestAttributes())

    const requests = parseRequests(Array.from({ length: MAX_OTLP_RECORDS + 10 }, () => record))

    expect(requests).toHaveLength(MAX_OTLP_RECORDS)
  })

  it('counts records of other events toward the cap', () => {
    const other = logRecord(apiRequestAttributes({ 'event.name': 'tool_result' }))
    const real = logRecord(apiRequestAttributes())

    const requests = parseRequests([...Array.from({ length: MAX_OTLP_RECORDS }, () => other), real])

    expect(requests).toEqual([])
  })

  it.each(['0x10', '', '   ', '1,5', 'Infinity'])(
    'drops a record whose cost is the non-decimal text %j',
    (text) => {
      expect(oneRequest({ cost_usd: { stringValue: text } })).toEqual([])
    }
  )

  it('accepts a body with no resource logs as an empty batch', () => {
    expect(parseOtlpLogs({ resourceLogs: [] })).toEqual({ ok: true, value: [] })
  })

  it.each([null, 'text', 42, [], {}, { resourceLogs: 'nope' }])(
    'rejects a body that is not an OTLP logs request: %j',
    (body) => {
      expect(parseOtlpLogs(body)).toEqual({ ok: false, error: 'malformed' })
    }
  )
})
