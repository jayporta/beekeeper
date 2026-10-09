import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { OtelReceiverDto } from '../../../../../../shared/ipc/otelReceiverDto'
import type { ReportedCostDto } from '../../../../../../shared/ipc/reportedCostDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { SCENE_SESSION } from '../../graph/testGraphScene'
import { inspector, renderInspectorScene } from '../testInspectorScene'

afterEach(() => {
  useNavigationStore.getState().reset()
})

const LISTENING: OtelReceiverDto = {
  enabled: true,
  status: 'listening',
  failure: null,
  port: 23456,
  token: 'tok'
}
const REPORTED: ReportedCostDto = {
  costUsd: 1.5,
  requests: 4,
  tokens: { input: 1, output: 2, cacheRead: 3, cacheCreation: 4 },
  byAgent: [
    { agentId: null, costUsd: 1.2 },
    { agentId: 'a1', costUsd: 0.3 }
  ]
}

function renderWithTelemetry(): void {
  renderInspectorScene({
    apiOverrides: {
      getOtelReceiver: () => Promise.resolve({ ok: true, value: LISTENING }),
      getReportedCost: (sessionId) =>
        Promise.resolve({
          ok: true,
          value: sessionId === SCENE_SESSION.sessionId ? REPORTED : null
        })
    }
  })
}

describe('the inspector with the telemetry receiver listening', () => {
  it('gives Claude Code’s estimate for the session under the lead’s totals', async () => {
    renderWithTelemetry()

    expect(
      await inspector().findByText("Claude Code's estimate for this session: $1.50")
    ).toBeTruthy()
  })

  it('gives a subagent its own reported share', async () => {
    renderWithTelemetry()
    await userEvent.click(screen.getByRole('button', { name: /scout/ }))

    expect(await inspector().findByText("Claude Code's estimate: $0.30")).toBeTruthy()
  })

  it('gives a subagent with no reported share no estimate', async () => {
    renderWithTelemetry()
    await userEvent.click(screen.getByRole('button', { name: /reader/ }))
    await inspector().findByRole('heading', { level: 2, name: /reader/ })

    expect(inspector().queryByText(/Claude Code's estimate/)).toBeNull()
  })
})

describe('the inspector with the telemetry receiver off', () => {
  it('shows no estimate', async () => {
    const { api } = renderInspectorScene()
    await inspector().findByText('Lead session')

    expect(inspector().queryByText(/Claude Code's estimate/)).toBeNull()
    expect(api.getReportedCost).not.toHaveBeenCalled()
  })
})
