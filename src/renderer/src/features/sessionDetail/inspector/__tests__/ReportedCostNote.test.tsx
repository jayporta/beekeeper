import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OtelReceiverDto } from '../../../../../../shared/ipc/otelReceiverDto'
import type { ReportedCostDto } from '../../../../../../shared/ipc/reportedCostDto'
import { REPORTED_COST_POLL_MS } from '@renderer/features/telemetry/useReportedCost'
import { installBeekeeperApi, type TestBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { ReportedCostNote } from '../ReportedCostNote'

const SESSION = '11111111-2222-4333-8444-555555555555'
const LISTENING: OtelReceiverDto = {
  enabled: true,
  status: 'listening',
  failure: null,
  port: 47318,
  token: 'tok'
}
const reported = (overrides: Partial<ReportedCostDto> = {}): ReportedCostDto => ({
  costUsd: 1.5,
  requests: 3,
  tokens: { input: 1, output: 2, cacheRead: 3, cacheCreation: 4 },
  byAgent: [
    { agentId: null, costUsd: 1.1 },
    { agentId: 'sub-1', costUsd: 0.4 }
  ],
  ...overrides
})

afterEach(() => {
  vi.useRealTimers()
})

function stub(
  cost: ReportedCostDto | null,
  receiver: OtelReceiverDto = LISTENING
): TestBeekeeperApi {
  return installBeekeeperApi({
    getOtelReceiver: () => Promise.resolve({ ok: true, value: receiver }),
    getReportedCost: () => Promise.resolve({ ok: true, value: cost })
  })
}

function renderNote(agentId: string | null): HTMLElement {
  return render(<ReportedCostNote sessionId={SESSION} agentId={agentId} />, {
    wrapper: createQueryWrapper()
  }).container
}

describe('ReportedCostNote', () => {
  it('gives the whole session’s reported cost for the lead', async () => {
    stub(reported())
    renderNote(null)

    expect(await screen.findByText("Claude Code's estimate for this session: $1.50")).toBeTruthy()
  })

  it('reads a cost under a cent as such', async () => {
    stub(reported({ costUsd: 0.004 }))
    renderNote(null)

    expect(await screen.findByText("Claude Code's estimate for this session: <$0.01")).toBeTruthy()
  })

  it('gives a subagent’s own share when its id matches exactly', async () => {
    stub(reported())
    renderNote('sub-1')

    expect(await screen.findByText("Claude Code's estimate: $0.40")).toBeTruthy()
  })

  it('shows nothing for a subagent with no share under its id', async () => {
    const api = stub(reported())
    const container = renderNote('sub-2')
    await vi.waitFor(() => {
      expect(api.getReportedCost).toHaveBeenCalled()
    })

    expect(container.textContent).toBe('')
  })

  it('does not match a subagent id by prefix', async () => {
    const api = stub(reported({ byAgent: [{ agentId: 'sub-10', costUsd: 9 }] }))
    const container = renderNote('sub-1')
    await vi.waitFor(() => {
      expect(api.getReportedCost).toHaveBeenCalled()
    })

    expect(container.textContent).toBe('')
  })

  it('shows nothing when the session reported nothing', async () => {
    const api = stub(null)
    const container = renderNote(null)
    await vi.waitFor(() => {
      expect(api.getReportedCost).toHaveBeenCalled()
    })

    expect(container.textContent).toBe('')
  })

  it('does not ask for a reported cost while the receiver is off', async () => {
    const api = stub(reported(), { ...LISTENING, enabled: false, status: 'off', token: null })
    const container = renderNote(null)
    await vi.waitFor(() => {
      expect(api.getOtelReceiver).toHaveBeenCalled()
    })

    expect([api.getReportedCost.mock.calls.length, container.textContent]).toEqual([0, ''])
  })

  it('says the estimate is not available when the call fails', async () => {
    installBeekeeperApi({
      getOtelReceiver: () => Promise.resolve({ ok: true, value: LISTENING }),
      getReportedCost: () => Promise.resolve({ ok: false, error: { code: 'untrusted-sender' } })
    })
    renderNote(null)

    expect(await screen.findByText("Claude Code's estimate isn't available.")).toBeTruthy()
  })

  it('keeps the last figure when a later read fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let calls = 0
    installBeekeeperApi({
      getOtelReceiver: () => Promise.resolve({ ok: true, value: LISTENING }),
      getReportedCost: () =>
        ++calls === 1
          ? Promise.resolve({ ok: true, value: reported() })
          : Promise.resolve({ ok: false, error: { code: 'internal' } })
    })
    renderNote(null)
    await screen.findByText("Claude Code's estimate for this session: $1.50")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REPORTED_COST_POLL_MS * 2)
    })

    expect(calls).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("Claude Code's estimate for this session: $1.50")).toBeTruthy()
    expect(screen.queryByText("Claude Code's estimate isn't available.")).toBeNull()
  })

  it('reads again every five seconds while the receiver is listening', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const api = stub(reported())
    renderNote(null)
    await vi.waitFor(() => {
      expect(api.getReportedCost).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REPORTED_COST_POLL_MS)
    })

    expect(api.getReportedCost.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('polls every 5000 milliseconds', () => {
    expect(REPORTED_COST_POLL_MS).toBe(5000)
  })
})
