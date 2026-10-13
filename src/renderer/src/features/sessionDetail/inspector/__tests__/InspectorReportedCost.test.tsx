import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { OtelReceiverDto } from '../../../../../../shared/ipc/otelReceiverDto'
import type { ReportedCostDto } from '../../../../../../shared/ipc/reportedCostDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { SCENE_SESSION } from '../../graph/testGraphScene'
import { inspector, renderInspectorScene, stat } from '../testInspectorScene'

afterEach(() => {
  useNavigationStore.getState().reset()
})

/** An agent's button in the graph, not the summary cards' rows for the same agent. */
const graphNode = (name: RegExp): HTMLElement =>
  within(screen.getByRole('region', { name: 'Agent graph' })).getByRole('button', { name })

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

const SESSION_LABEL = "Claude Code's estimate for this session"
const AGENT_LABEL = "Claude Code's estimate"

describe('the inspector with the telemetry receiver listening', () => {
  it('gives Claude Code’s estimate for the session in the lead’s stat grid', async () => {
    renderWithTelemetry()

    await waitFor(() => {
      expect(stat(SESSION_LABEL).textContent).toBe('$1.50')
    })
  })

  it('gives a subagent its own reported share', async () => {
    renderWithTelemetry()
    await userEvent.click(graphNode(/scout/))

    await waitFor(() => {
      expect(stat(AGENT_LABEL).textContent).toBe('$0.30')
    })
  })

  it('says not available for a subagent with no reported share', async () => {
    renderWithTelemetry()
    await userEvent.click(graphNode(/reader/))
    await inspector().findByRole('heading', { level: 2, name: /reader/ })

    expect(stat(AGENT_LABEL).textContent).toBe('Not available')
  })
})

describe('the inspector with the telemetry receiver off', () => {
  it('says the estimate is not available and asks for none', async () => {
    const { api } = renderInspectorScene()
    await inspector().findByText('Lead session')

    expect(stat(SESSION_LABEL).textContent).toBe('Not available')
    expect(api.getReportedCost).not.toHaveBeenCalled()
  })
})
