import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { PARTIAL_FOOTNOTE_ID } from '../partialFootnoteId'
import type { SessionRow } from '../../../../../shared/sessions/sessionRow'
import { TeammateRow } from '../TeammateRow'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../../../../../shared/sessions/testSessionFixtures'
import { testRow } from '../../../../../shared/sessions/testSessionRows'

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

function renderRow(
  teammate: SessionRow,
  options: { highlighted?: boolean; sessionTokens?: number | null } = {}
): void {
  const { highlighted = false, sessionTokens = null } = options
  render(
    <TeammateRow
      teammate={teammate}
      leadRef={LEAD_REF}
      selectedDirName={DIR}
      highlighted={highlighted}
      sessionTokens={sessionTokens}
    />
  )
}

describe('TeammateRow', () => {
  it('reads the teammate name, its type, then its tokens', () => {
    renderRow(teammateRow({ totalTokens: 1500 }))

    expect(screen.getByRole('button', { name: 'reviewer code 1.5K tokens' })).toBeTruthy()
  })

  it('shows the name and the type apart', () => {
    renderRow(teammateRow({ totalTokens: 1500 }))

    expect(screen.getByText('reviewer')).toBeTruthy()
    expect(screen.getByText('code')).toBeTruthy()
  })

  it('names a teammate with no agent name by its type alone, with no type beside it', () => {
    renderRow(teammateRow({ totalTokens: 1500, role: testAgentRole(null, 'code') }))

    expect(screen.getAllByText('code')).toHaveLength(1)
  })

  it('notes how many subagents the teammate ran, and nothing when it ran none', () => {
    renderRow(teammateRow({ totalTokens: 1500, subagentCount: 2 }))

    expect(
      screen.getByRole('button', { name: 'reviewer code 2 subagents 1.5K tokens' })
    ).toBeTruthy()
  })

  it('notes the workflows a teammate ran, instead of counting their agents as subagents', () => {
    renderRow(
      teammateRow({ totalTokens: 1500, subagentCount: 3, workflows: { runs: 1, agents: 3 } })
    )

    expect(
      screen.getByRole('button', { name: 'reviewer code 1 workflow (3 agents) 1.5K tokens' })
    ).toBeTruthy()
  })

  it('notes plain subagents beside workflows', () => {
    renderRow(
      teammateRow({ totalTokens: 1500, subagentCount: 5, workflows: { runs: 1, agents: 3 } })
    )

    expect(
      screen.getByRole('button', {
        name: 'reviewer code 2 subagents 1 workflow (3 agents) 1.5K tokens'
      })
    ).toBeTruthy()
  })

  it('shows a teammate its lead stopped with a stopped pill', () => {
    renderRow(teammateRow({ totalTokens: 1500 }, testTeammateTeam(LEAD_REF, true)))

    expect(screen.getByRole('button', { name: 'reviewer code stopped 1.5K tokens' })).toBeTruthy()
    expect(screen.getByText('stopped').tagName).toBe('SPAN')
  })

  it('notes a teammate that lives in another folder', () => {
    renderRow(teammateRow({ totalTokens: 1500, projectDirName: '-other' }))

    expect(screen.getByRole('button', { name: 'reviewer code in -other 1.5K tokens' })).toBeTruthy()
  })

  it('names the missing tokens for assistive technology', () => {
    renderRow(teammateRow())

    expect(screen.getByRole('button').textContent).toContain('-tokens not recorded')
  })

  it('marks tokens that leave out subagents as partial', () => {
    renderRow(teammateRow({ transcriptTokens: 400, subagentCount: 1 }))

    expect(screen.getByText('¹').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('button').textContent).toContain('partial, see the note below the list')
  })

  it('points a partial row at the footnote, and an exact one at nothing', () => {
    const { unmount } = render(
      <TeammateRow
        teammate={teammateRow({ transcriptTokens: 400, subagentCount: 1 })}
        leadRef={LEAD_REF}
        selectedDirName={DIR}
        highlighted={false}
        sessionTokens={null}
      />
    )
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBe(PARTIAL_FOOTNOTE_ID)
    unmount()

    renderRow(teammateRow({ totalTokens: 400 }))
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBeNull()
  })

  it('shows no partial marker for recorded tokens', () => {
    renderRow(teammateRow({ totalTokens: 400, transcriptTokens: 900, subagentCount: 1 }))

    expect(screen.queryByText('¹')).toBeNull()
  })

  it('shows the share of the session, named for assistive technology', () => {
    renderRow(teammateRow({ totalTokens: 250 }), { sessionTokens: 1000 })

    expect(screen.getByText('25%')).toBeTruthy()
    expect(screen.getByRole('button').textContent).toContain('25% of the session')
  })

  it('never shows a share past 100%, even when the teammate has more than the session total', () => {
    renderRow(teammateRow({ totalTokens: 5000 }), { sessionTokens: 1000 })

    expect(screen.getByText('100%')).toBeTruthy()
  })

  it('shows no percent when the session shows no tokens, rather than NaN or infinity', () => {
    renderRow(teammateRow({ totalTokens: 5000 }), { sessionTokens: 0 })

    expect(screen.getByRole('button').textContent).not.toMatch(/%|NaN|Infinity/)
  })

  it('shows no percent when the teammate has no tokens', () => {
    renderRow(teammateRow(), { sessionTokens: 1000 })

    expect(screen.getByRole('button').textContent).not.toMatch(/%/)
  })

  it('says it matches the search only when highlighted', () => {
    renderRow(teammateRow({ totalTokens: 1 }), { highlighted: true })

    expect(screen.getByRole('button', { name: /matches search/ })).toBeTruthy()
  })

  it('says nothing about a search when not highlighted', () => {
    renderRow(teammateRow({ totalTokens: 1 }))

    expect(screen.queryByText('matches search')).toBeNull()
  })

  it("opens the lead's session with that teammate selected, by its own ref", async () => {
    renderRow(teammateRow({ totalTokens: 1, projectDirName: '-other' }))

    await userEvent.click(screen.getByRole('button'))

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: LEAD_REF,
      selectedAgent: { kind: 'teammate', ref: testRef(2, '-other') }
    })
  })

  it('can be opened from the keyboard', async () => {
    renderRow(teammateRow({ totalTokens: 1 }))

    screen.getByRole('button').focus()
    await userEvent.keyboard('{Enter}')

    expect(useNavigationStore.getState().view).toBe('session')
  })
})
