import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AgentStrip } from '../AgentStrip'
import { AGENT_MARK_LIMIT } from '../agentMarks'
import { testLeadTeam, testRef, testSession } from '../testSessionFixtures'

/** The marks the strip draws. They are decorative, so they have no role or text to query. */
const marks = (container: HTMLElement): NodeListOf<Element> =>
  container.querySelectorAll('[data-kind]')

describe('AgentStrip', () => {
  it('draws a mark for the session, each teammate, and each subagent, in order', () => {
    const item = testSession(1, { team: testLeadTeam([testRef(2), testRef(3)]), subagentCount: 1 })

    const { container } = render(<AgentStrip item={item} />)

    expect([...marks(container)].map((mark) => mark.getAttribute('data-kind'))).toEqual([
      'lead',
      'teammate',
      'teammate',
      'subagent'
    ])
  })

  it('hides the whole strip from assistive technology', () => {
    const { container } = render(<AgentStrip item={testSession(1)} />)

    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })

  it('says how many agents the marks leave out when there are more than the limit', () => {
    const { container } = render(<AgentStrip item={testSession(1, { subagentCount: 40 })} />)

    expect(marks(container)).toHaveLength(AGENT_MARK_LIMIT)
    expect(screen.getByText('+29')).toBeTruthy()
  })

  it('adds no count when every agent has a mark', () => {
    render(<AgentStrip item={testSession(1, { subagentCount: 2 })} />)

    expect(screen.queryByText(/^\+/)).toBeNull()
  })
})
