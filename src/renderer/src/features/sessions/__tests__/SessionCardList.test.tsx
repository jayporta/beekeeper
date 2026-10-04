import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { groupSessionRows } from '../groupSessionRows'
import { SessionCardList } from '../SessionCardList'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../testSessionFixtures'
import { testSessionsT } from '../testSessionsT'

/** How many times each card's title cell has rendered, by the card's title. */
const renders = vi.hoisted(() => new Map<string, number>())

vi.mock('../SessionCell', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../SessionCell')>()
  return {
    SessionCell: (props: Parameters<typeof actual.SessionCell>[0]) => {
      const title = props.row.label.text
      renders.set(title, (renders.get(title) ?? 0) + 1)
      return actual.SessionCell(props)
    }
  }
})

const lead = testSession(1, {
  title: 'With chips',
  latestMs: 2,
  totalTokens: 5,
  team: testLeadTeam([testRef(2)])
})
const mate = testSession(2, {
  role: testAgentRole('reviewer', 'code'),
  totalTokens: 1,
  team: testTeammateTeam(testRef(1))
})
const solo = testSession(3, {
  title: 'No chips',
  latestMs: 1,
  totalTokens: 5,
  agentTerms: [{ name: 'scout', description: null, agentType: 'Explore' }]
})
const rows = groupSessionRows([lead, mate, solo], testSessionsT)

const list = (query: string, shown = rows): React.JSX.Element => (
  <SessionCardList rows={shown} labelledBy="h" selectedDirName="-p" query={query} />
)

beforeEach(() => {
  renders.clear()
})

describe('SessionCardList rendering', () => {
  it('re-renders only the cards with chips when the search changes', () => {
    const { rerender } = render(list(''))

    rerender(list('rev', [...rows]))

    expect(renders.get('With chips')).toBe(2)
    expect(renders.get('No chips')).toBe(1)
  })

  it('re-renders a card without chips only when its subagent match note changes', () => {
    const { rerender } = render(list(''))

    rerender(list('rev', [...rows]))
    expect(renders.get('No chips')).toBe(1)
    rerender(list('scout', [...rows]))
    expect(renders.get('No chips')).toBe(2)
    rerender(list('scou', [...rows]))
    expect(renders.get('No chips')).toBe(2)
    rerender(list('scouts', [...rows]))
    expect(renders.get('No chips')).toBe(3)
  })

  it('updates a card’s note when only the search changes', () => {
    const { rerender } = render(list(''))
    expect(screen.queryByText('matches')).toBeNull()

    rerender(list('scout'))

    expect(screen.getByText('matches')).toBeTruthy()
  })

  it('updates a card’s note when only the search changes', () => {
    const { rerender } = render(list(''))
    expect(screen.queryByText('matches')).toBeNull()

    rerender(list('scout'))

    expect(screen.getByText('matches')).toBeTruthy()
  })

  it('re-renders no card when the same rows come again with the same search', () => {
    const { rerender } = render(list(''))

    rerender(list('', [...rows]))

    expect(renders.get('With chips')).toBe(1)
    expect(renders.get('No chips')).toBe(1)
  })
})
