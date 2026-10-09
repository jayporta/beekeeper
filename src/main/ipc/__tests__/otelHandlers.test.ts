import { describe, expect, it } from 'vitest'
import type { OtelReceiverDto } from '../../../shared/ipc/otelReceiverDto'
import type { ReportedCostDto } from '../../../shared/ipc/reportedCostDto'
import { getOtelReceiverHandler } from '../getOtelReceiverHandler'
import { getReportedCostHandler } from '../getReportedCostHandler'
import { setOtelReceiverEnabledHandler } from '../setOtelReceiverEnabledHandler'
import type { OtelRuntime } from '../../otel/createOtelRuntime'
import { OTEL_RECEIVER_PORT } from '../../otel/createOtelReceiver'
import { TEST_SESSION_ID } from '../../otel/testOtlpLogs'

const OFF: OtelReceiverDto = {
  enabled: false,
  status: 'off',
  failure: null,
  port: OTEL_RECEIVER_PORT,
  token: null
}
const ON: OtelReceiverDto = { ...OFF, enabled: true, status: 'listening', token: 'tok' }
const REPORTED: ReportedCostDto = {
  costUsd: 1,
  requests: 2,
  tokens: { input: 1, output: 2, cacheRead: 3, cacheCreation: 4 },
  byAgent: [{ agentId: null, costUsd: 1 }]
}

function fakeRuntime(calls: boolean[] = []): OtelRuntime {
  return {
    receiver: {
      get: () => Promise.resolve(OFF),
      setEnabled: (enabled) => {
        calls.push(enabled)
        return Promise.resolve(enabled ? ON : OFF)
      },
      startFromSettings: () => Promise.resolve(),
      stop: () => Promise.resolve()
    },
    costs: {
      record: () => undefined,
      get: (sessionId) => (sessionId === TEST_SESSION_ID ? REPORTED : null)
    }
  }
}

describe('getOtelReceiverHandler', () => {
  it('returns the controller state', async () => {
    expect(await getOtelReceiverHandler({ otel: fakeRuntime() })).toEqual({ ok: true, value: OFF })
  })

  it('reports an off receiver on the default port when the telemetry receiver is not wired', async () => {
    expect(await getOtelReceiverHandler({ otel: null })).toEqual({ ok: true, value: OFF })
  })
})

describe('setOtelReceiverEnabledHandler', () => {
  it.each([true, false])('applies enabled: %s and returns the new state', async (enabled) => {
    const calls: boolean[] = []

    const result = await setOtelReceiverEnabledHandler({ otel: fakeRuntime(calls) }, { enabled })

    expect([result, calls]).toEqual([{ ok: true, value: enabled ? ON : OFF }, [enabled]])
  })

  it.each([undefined, null, {}, { enabled: 'yes' }, { enabled: true, extra: 1 }])(
    'refuses the payload %j without changing anything',
    async (payload) => {
      const calls: boolean[] = []

      const result = await setOtelReceiverEnabledHandler({ otel: fakeRuntime(calls) }, payload)

      expect([result, calls]).toEqual([{ ok: false, error: { code: 'invalid-request' } }, []])
    }
  )

  it('fails with an internal error when the telemetry receiver is not wired', async () => {
    expect(await setOtelReceiverEnabledHandler({ otel: null }, { enabled: true })).toEqual({
      ok: false,
      error: { code: 'internal' }
    })
  })
})

describe('getReportedCostHandler', () => {
  it('returns what a session reported', async () => {
    expect(
      await getReportedCostHandler({ otel: fakeRuntime() }, { sessionId: TEST_SESSION_ID })
    ).toEqual({ ok: true, value: REPORTED })
  })

  it('returns null for a session that reported nothing', async () => {
    expect(
      await getReportedCostHandler(
        { otel: fakeRuntime() },
        { sessionId: '99999999-2222-4333-8444-555555555555' }
      )
    ).toEqual({ ok: true, value: null })
  })

  it.each([undefined, {}, { sessionId: 'nope' }, { sessionId: TEST_SESSION_ID, extra: 1 }])(
    'refuses the payload %j',
    async (payload) => {
      expect(await getReportedCostHandler({ otel: fakeRuntime() }, payload)).toEqual({
        ok: false,
        error: { code: 'invalid-request' }
      })
    }
  )

  it('returns null when the telemetry receiver is not wired', async () => {
    expect(await getReportedCostHandler({ otel: null }, { sessionId: TEST_SESSION_ID })).toEqual({
      ok: true,
      value: null
    })
  })
})
