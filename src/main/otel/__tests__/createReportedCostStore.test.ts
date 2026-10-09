import { describe, expect, it } from 'vitest'
import {
  createReportedCostStore,
  MAX_AGENTS_PER_SESSION,
  MAX_REQUEST_IDS_PER_SESSION,
  MAX_STORED_SESSIONS
} from '../createReportedCostStore'
import { MAX_OTLP_RECORDS, type ReportedApiRequest } from '../parseOtlpLogs'
import { TEST_SESSION_ID } from '../testOtlpLogs'

function request(overrides: Partial<ReportedApiRequest> = {}): ReportedApiRequest {
  return {
    sessionId: TEST_SESSION_ID,
    costUsd: 1,
    inputTokens: 10,
    outputTokens: 20,
    cacheReadTokens: 30,
    cacheCreationTokens: 40,
    model: null,
    agentId: null,
    requestId: null,
    ...overrides
  }
}

function sessionId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

describe('createReportedCostStore', () => {
  it('reports nothing for a session that never reported', () => {
    expect(createReportedCostStore().get(TEST_SESSION_ID)).toBeNull()
  })

  it('sums the cost, request count and tokens of a session', () => {
    const store = createReportedCostStore()

    store.record([request({ costUsd: 1.5 }), request({ costUsd: 0.25 })])
    store.record([request({ costUsd: 2 })])

    expect(store.get(TEST_SESSION_ID)).toMatchObject({
      costUsd: 3.75,
      requests: 3,
      tokens: { input: 30, output: 60, cacheRead: 90, cacheCreation: 120 }
    })
  })

  it('keeps sessions apart', () => {
    const store = createReportedCostStore()

    store.record([request({ sessionId: sessionId(1), costUsd: 1 })])
    store.record([request({ sessionId: sessionId(2), costUsd: 2 })])

    expect([store.get(sessionId(1))?.costUsd, store.get(sessionId(2))?.costUsd]).toEqual([1, 2])
  })

  it('counts a request id once however often it is reported', () => {
    const store = createReportedCostStore()

    store.record([request({ requestId: 'req_1' }), request({ requestId: 'req_1' })])
    store.record([request({ requestId: 'req_1' })])

    expect(store.get(TEST_SESSION_ID)).toMatchObject({ costUsd: 1, requests: 1 })
  })

  it.each([501, MAX_OTLP_RECORDS])('counts a retried export of %i requests once', (size) => {
    const store = createReportedCostStore()
    const batch = Array.from({ length: size }, (_, i) => request({ requestId: `r${i}` }))
    store.record(batch)
    const once = store.get(TEST_SESSION_ID)

    store.record(batch)

    expect(store.get(TEST_SESSION_ID)).toEqual(once)
    expect(once?.requests).toBe(size)
  })

  it('counts a retried export once when part of it was seen before and the rest is new', () => {
    const store = createReportedCostStore()
    const ids = (from: number, to: number): ReportedApiRequest[] =>
      Array.from({ length: to - from }, (_, i) => request({ requestId: `r${from + i}` }))
    store.record(ids(0, MAX_REQUEST_IDS_PER_SESSION))
    // The batch holds the oldest remembered ids and as many new ones as the set can hold beside them.
    const batch = [
      ...ids(0, 100),
      ...ids(MAX_REQUEST_IDS_PER_SESSION, MAX_REQUEST_IDS_PER_SESSION + 4000)
    ]
    store.record(batch)
    const once = store.get(TEST_SESSION_ID)

    store.record(batch)

    expect(store.get(TEST_SESSION_ID)).toEqual(once)
    expect(once?.requests).toBe(MAX_REQUEST_IDS_PER_SESSION + 4000)
  })

  it('counts a request id repeated within one export once', () => {
    const store = createReportedCostStore()

    store.record([request({ requestId: 'same' }), request({ requestId: 'same' })])

    expect(store.get(TEST_SESSION_ID)?.requests).toBe(1)
  })

  it('counts a repeated request id again in another session', () => {
    const store = createReportedCostStore()

    store.record([request({ sessionId: sessionId(1), requestId: 'req_1' })])
    store.record([request({ sessionId: sessionId(2), requestId: 'req_1' })])

    expect(store.get(sessionId(2))?.requests).toBe(1)
  })

  it('counts every request that has no request id', () => {
    const store = createReportedCostStore()

    store.record([request(), request()])

    expect(store.get(TEST_SESSION_ID)?.requests).toBe(2)
  })

  it('forgets the oldest request ids past the per-session cap', () => {
    const store = createReportedCostStore()
    store.record([request({ requestId: 'first' })])
    store.record(
      Array.from({ length: MAX_REQUEST_IDS_PER_SESSION }, (_, i) => request({ requestId: `r${i}` }))
    )

    store.record([request({ requestId: 'first' })])

    expect(store.get(TEST_SESSION_ID)?.requests).toBe(MAX_REQUEST_IDS_PER_SESSION + 2)
  })

  it('splits the cost between the lead and each subagent, in first-report order', () => {
    const store = createReportedCostStore()

    store.record([
      request({ agentId: 'a1', costUsd: 2 }),
      request({ costUsd: 1 }),
      request({ agentId: 'a1', costUsd: 3 }),
      request({ agentId: 'a2', costUsd: 4 })
    ])

    expect(store.get(TEST_SESSION_ID)?.byAgent).toEqual([
      { agentId: 'a1', costUsd: 5 },
      { agentId: null, costUsd: 1 },
      { agentId: 'a2', costUsd: 4 }
    ])
  })

  it('keeps a subagent literally named lead apart from the lead', () => {
    const store = createReportedCostStore()

    store.record([request({ agentId: 'lead', costUsd: 2 }), request({ costUsd: 1 })])

    expect(store.get(TEST_SESSION_ID)?.byAgent).toEqual([
      { agentId: 'lead', costUsd: 2 },
      { agentId: null, costUsd: 1 }
    ])
  })

  it('still totals the cost of agents past the per-session agent cap', () => {
    const store = createReportedCostStore()
    const agents = Array.from({ length: MAX_AGENTS_PER_SESSION + 1 }, (_, i) =>
      request({ agentId: `agent-${i}` })
    )

    store.record(agents)

    const snapshot = store.get(TEST_SESSION_ID)
    expect([snapshot?.byAgent.length, snapshot?.costUsd]).toEqual([
      MAX_AGENTS_PER_SESSION,
      MAX_AGENTS_PER_SESSION + 1
    ])
  })

  it('remembers at least as many request ids as one export can carry', () => {
    expect(MAX_REQUEST_IDS_PER_SESSION).toBeGreaterThanOrEqual(MAX_OTLP_RECORDS)
  })

  it('evicts the least recently reported session past the session cap', () => {
    const store = createReportedCostStore()
    for (let n = 0; n < MAX_STORED_SESSIONS; n += 1) {
      store.record([request({ sessionId: sessionId(n) })])
    }

    store.record([request({ sessionId: sessionId(MAX_STORED_SESSIONS) })])

    expect([store.get(sessionId(0)), store.get(sessionId(1))?.requests]).toEqual([null, 1])
  })

  it('keeps a session that reported again when the cap evicts', () => {
    const store = createReportedCostStore()
    for (let n = 0; n < MAX_STORED_SESSIONS; n += 1) {
      store.record([request({ sessionId: sessionId(n) })])
    }
    store.record([request({ sessionId: sessionId(0) })])

    store.record([request({ sessionId: sessionId(MAX_STORED_SESSIONS) })])

    expect([store.get(sessionId(0))?.requests, store.get(sessionId(1))]).toEqual([2, null])
  })

  it('returns a snapshot that later reports do not change', () => {
    const store = createReportedCostStore()
    store.record([request()])
    const before = store.get(TEST_SESSION_ID)

    store.record([request()])

    expect([before?.requests, before?.costUsd, before?.byAgent]).toEqual([
      1,
      1,
      [{ agentId: null, costUsd: 1 }]
    ])
  })
})
