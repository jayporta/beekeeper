import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../shared/ipc/emptyAgentSignals'
import { groupSessionRows } from '../groupSessionRows'
import { SignalScopeNote } from '../SignalScopeNote'
import { testSession } from '../testSessionFixtures'
import { testSessionsT } from '../testSessionsT'

const NOTE = 'Card counts cover the lead and its teammates. Open a session to see its subagents.'

const counted = testSession(1, { signals: { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 2 } })
const quiet = testSession(2)
const unreadable = testSession(3, { unreadable: true })

function renderNote(...items: Parameters<typeof groupSessionRows>[0]): void {
  render(<SignalScopeNote rows={groupSessionRows(items, testSessionsT)} />)
}

describe('SignalScopeNote', () => {
  it('says what the card counts cover when a row has a count', () => {
    renderNote(counted, quiet)

    expect(screen.getByText(NOTE)).toBeTruthy()
  })

  it('says it for a row whose only count is agent kills', () => {
    renderNote(testSession(4, { signals: { ...EMPTY_AGENT_SIGNALS_DTO, agentsKilled: 1 } }))

    expect(screen.getByText(NOTE)).toBeTruthy()
  })

  it('renders nothing when no row has a count', () => {
    renderNote(quiet, unreadable)

    expect(screen.queryByText(NOTE)).toBeNull()
  })
})
