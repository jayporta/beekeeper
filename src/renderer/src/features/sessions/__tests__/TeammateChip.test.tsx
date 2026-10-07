import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { PARTIAL_FOOTNOTE_ID } from '../partialFootnoteId'
import type { SessionRow } from '../sessionRow'
import { TeammateChip } from '../TeammateChip'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../testSessionFixtures'
import { testRow } from '../testSessionRows'

const DIR = '-p'
const LEAD_REF = testRef(1)

afterEach(() => {
  useNavigationStore.getState().reset()
})

/** The chip's row: teammate session 2 under lead 1, with the teammate adjustable. */
function teammateRow(
  options: Parameters<typeof testSession>[1] = {},
  team = testTeammateTeam(LEAD_REF)
): SessionRow {
  const lead = testSession(1, { team: testLeadTeam([testRef(2, options.projectDirName ?? DIR)]) })
  const mate: SessionListItemDto = testSession(2, {
    role: testAgentRole('reviewer', 'code'),
    team,
    ...options
  })
  const teammate = testRow(1, [lead, mate]).teammates[0]
  if (teammate === undefined) throw new Error('the teammate was not grouped under its lead')
  return teammate
}

function renderChip(teammate: SessionRow, highlighted = false): void {
  render(
    <TeammateChip
      teammate={teammate}
      leadRef={LEAD_REF}
      selectedDirName={DIR}
      highlighted={highlighted}
    />
  )
}

describe('TeammateChip', () => {
  it('reads the teammate name, then its tokens', () => {
    renderChip(teammateRow({ totalTokens: 1500 }))

    expect(screen.getByRole('button', { name: 'reviewer (code) 1.5K tokens' })).toBeTruthy()
  })

  it('notes how many subagents the teammate ran, and nothing when it ran none', () => {
    renderChip(teammateRow({ totalTokens: 1500, subagentCount: 2 }))

    expect(
      screen.getByRole('button', { name: 'reviewer (code) 2 subagents 1.5K tokens' })
    ).toBeTruthy()
  })

  it('notes the workflows a teammate ran, instead of counting their agents as subagents', () => {
    renderChip(
      teammateRow({ totalTokens: 1500, subagentCount: 3, workflows: { runs: 1, agents: 3 } })
    )

    expect(
      screen.getByRole('button', { name: 'reviewer (code) 1 workflow (3 agents) 1.5K tokens' })
    ).toBeTruthy()
  })

  it('notes plain subagents beside workflows', () => {
    renderChip(
      teammateRow({ totalTokens: 1500, subagentCount: 5, workflows: { runs: 1, agents: 3 } })
    )

    expect(
      screen.getByRole('button', {
        name: 'reviewer (code) 2 subagents 1 workflow (3 agents) 1.5K tokens'
      })
    ).toBeTruthy()
  })

  it('notes a teammate its lead stopped', () => {
    renderChip(teammateRow({ totalTokens: 1500 }, testTeammateTeam(LEAD_REF, true)))

    expect(screen.getByRole('button', { name: 'reviewer (code) stopped 1.5K tokens' })).toBeTruthy()
  })

  it('notes a teammate that lives in another folder', () => {
    renderChip(teammateRow({ totalTokens: 1500, projectDirName: '-other' }))

    expect(
      screen.getByRole('button', { name: 'reviewer (code) in -other 1.5K tokens' })
    ).toBeTruthy()
  })

  it('names the missing tokens for assistive technology', () => {
    renderChip(teammateRow())

    expect(screen.getByRole('button').textContent).toContain('-tokens not recorded')
  })

  it('marks tokens that leave out subagents as partial', () => {
    renderChip(teammateRow({ transcriptTokens: 400, subagentCount: 1 }))

    expect(screen.getByText('¹').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('button').textContent).toContain('partial, see the note below the list')
  })

  it('points a partial chip at the footnote, and an exact one at nothing', () => {
    const { unmount } = render(
      <TeammateChip
        teammate={teammateRow({ transcriptTokens: 400, subagentCount: 1 })}
        leadRef={LEAD_REF}
        selectedDirName={DIR}
        highlighted={false}
      />
    )
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBe(PARTIAL_FOOTNOTE_ID)
    unmount()

    renderChip(teammateRow({ totalTokens: 400 }))
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBeNull()
  })

  it('shows no partial marker for recorded tokens', () => {
    renderChip(teammateRow({ totalTokens: 400, transcriptTokens: 900, subagentCount: 1 }))

    expect(screen.queryByText('¹')).toBeNull()
  })

  it('says it matches the search only when highlighted', () => {
    renderChip(teammateRow({ totalTokens: 1 }), true)
    expect(screen.getByRole('button', { name: /matches search/ })).toBeTruthy()
  })

  it('says nothing about a search when not highlighted', () => {
    renderChip(teammateRow({ totalTokens: 1 }))

    expect(screen.queryByText('matches search')).toBeNull()
  })

  it("opens the lead's session with that teammate selected, by its own ref", async () => {
    renderChip(teammateRow({ totalTokens: 1, projectDirName: '-other' }))

    await userEvent.click(screen.getByRole('button'))

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: LEAD_REF,
      selectedAgent: { kind: 'teammate', ref: testRef(2, '-other') }
    })
  })

  it('can be opened from the keyboard', async () => {
    renderChip(teammateRow({ totalTokens: 1 }))

    screen.getByRole('button').focus()
    await userEvent.keyboard('{Enter}')

    expect(useNavigationStore.getState().view).toBe('session')
  })
})
