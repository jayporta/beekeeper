import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../../shared/ipc/emptyAgentSignals'
import { InspectorSignals } from '../InspectorSignals'

describe('InspectorSignals', () => {
  it('has a Signals heading', () => {
    render(<InspectorSignals signals={EMPTY_AGENT_SIGNALS_DTO} showKills />)

    expect(screen.getByRole('heading', { name: 'Signals' })).toBeTruthy()
  })

  it('shows the agents killed term at zero for an agent that shows kills', () => {
    render(<InspectorSignals signals={EMPTY_AGENT_SIGNALS_DTO} showKills />)

    expect(screen.getByText('Agents killed')).toBeTruthy()
  })

  it('leaves out the agents killed term for an agent that does not show kills', () => {
    render(<InspectorSignals signals={EMPTY_AGENT_SIGNALS_DTO} showKills={false} />)

    expect(screen.queryByText('Agents killed')).toBeNull()
  })

  it('marks every value as partial when the signals are partial', () => {
    render(<InspectorSignals signals={{ ...EMPTY_AGENT_SIGNALS_DTO, partial: true }} showKills />)

    expect(screen.getAllByText('¹')).toHaveLength(5)
  })

  it('has no partial marker for whole signals', () => {
    render(<InspectorSignals signals={EMPTY_AGENT_SIGNALS_DTO} showKills />)

    expect(screen.queryByText('¹')).toBeNull()
  })

  it('notes that errors include blocked calls once there are errors', () => {
    render(
      <InspectorSignals
        signals={{ ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 2, longestErrorStreak: 1 }}
        showKills
      />
    )

    expect(screen.getByText('Includes calls a hook blocked or a person denied.')).toBeTruthy()
  })

  it('notes that a wait includes approval time once there is a wait', () => {
    render(
      <InspectorSignals
        signals={{ ...EMPTY_AGENT_SIGNALS_DTO, longestToolWait: { ms: 60_000, tool: 'Bash' } }}
        showKills
      />
    )

    expect(screen.getByText('Includes time waiting for approval.')).toBeTruthy()
  })
})
