import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { groupSessionRows } from '../../../../../shared/sessions/groupSessionRows'
import { SessionCardList } from '../SessionCardList'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '../../../../../shared/sessions/testSessionFixtures'
import { testLabelWords } from '../testLabelWords'

const lead = testSession(1, {
  title: 'Team lead',
  latestMs: 2,
  totalTokens: 1000,
  team: testLeadTeam([testRef(2), testRef(3)], testUsage({ teamTokens: 1000 }))
})
const reviewer = testSession(2, {
  role: testAgentRole('reviewer', 'code'),
  totalTokens: 100,
  team: testTeammateTeam(testRef(1))
})
const writer = testSession(3, {
  role: testAgentRole('writer', 'code'),
  totalTokens: 300,
  team: testTeammateTeam(testRef(1))
})
const solo = testSession(4, { title: 'Solo', latestMs: 1, totalTokens: 5 })

function list(query: string, items = [lead, reviewer, writer, solo]): React.JSX.Element {
  return (
    <SessionCardList
      rows={groupSessionRows(items, testLabelWords)}
      labelledBy="h"
      selectedDirName="-p"
      largestTokens={1000}
      matchCount={null}
      query={query}
    />
  )
}

afterEach(() => {
  useNavigationStore.getState().reset()
})

const toggle = (): HTMLElement => screen.getByRole('button', { name: /teammates/ })
const rowOf = (title: string): HTMLElement =>
  screen.getByRole('heading', { level: 3, name: title }).closest('li') as HTMLElement

describe('teammate rows of a session', () => {
  it('start closed, with the count as a button that is not expanded', () => {
    render(list(''))

    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: /^reviewer/ })).toBeNull()
  })

  it('open and close when the count is pressed', async () => {
    render(list(''))

    await userEvent.click(toggle())
    expect(screen.getByRole('button', { name: /^reviewer/ })).toBeTruthy()
    await userEvent.click(toggle())
    expect(screen.queryByRole('button', { name: /^reviewer/ })).toBeNull()
  })

  it('have no toggle on a session without teammates', () => {
    render(list(''))

    expect(within(rowOf('Solo')).queryByRole('button', { name: /teammate/ })).toBeNull()
  })

  it('point the toggle at the list only while it is on the page', async () => {
    render(list(''))
    expect(toggle().hasAttribute('aria-controls')).toBe(false)

    await userEvent.click(toggle())

    const id = toggle().getAttribute('aria-controls')
    expect(id).not.toBeNull()
    expect(document.getElementById(id ?? '')?.tagName).toBe('UL')
  })

  it('do not open the session when the toggle is pressed', async () => {
    render(list(''))

    await userEvent.click(toggle())

    expect(useNavigationStore.getState().view).not.toBe('session')
  })

  it('open by themselves when the search matches a teammate', () => {
    render(list('review'))

    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: /^reviewer/ })).toBeTruthy()
  })

  it('close again when the search clears, if the person never chose', () => {
    const { rerender } = render(list('review'))

    rerender(list(''))

    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('stay closed after a person closes an opened match, when the search changes', async () => {
    const { rerender } = render(list('review'))
    await userEvent.click(toggle())

    rerender(list('writ'))

    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('say which teammate matched while they are closed', async () => {
    render(list('review'))
    await userEvent.click(toggle())

    expect(screen.getByText('matching teammate reviewer')).toBeTruthy()
  })

  it('leave the matching-teammate note off while they are open', () => {
    render(list('review'))

    expect(screen.queryByText('matching teammate reviewer')).toBeNull()
  })

  it('show the teammate a share of the lead total, drawn from the same tokens', async () => {
    render(list(''))

    await userEvent.click(toggle())

    expect(screen.getByRole('button', { name: /^writer/ }).textContent).toContain('30%')
  })
})
