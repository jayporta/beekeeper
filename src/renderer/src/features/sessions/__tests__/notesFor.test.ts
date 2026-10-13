import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../shared/ipc/emptyAgentSignals'
import { groupSessionRows } from '../groupSessionRows'
import { notesFor } from '../notesFor'
import { testSession, testTeammateTeam, testRef } from '../testSessionFixtures'
import { testSessionsT } from '../testSessionsT'

const NOW = 1_000

/** The notes of the first row built from `items`. */
function notesOf(...items: Parameters<typeof groupSessionRows>[0]): ReturnType<typeof notesFor> {
  const [row] = groupSessionRows(items, testSessionsT)
  if (row === undefined) throw new Error('no row')
  return notesFor(row, { selectedDirName: '-p', nowMs: NOW, t: testSessionsT })
}

describe('notesFor', () => {
  it('has no notes for a plain session', () => {
    expect(notesOf(testSession(1))).toEqual({ pills: [], meta: [] })
  })

  it('shows an archived session as a neutral pill', () => {
    expect(notesOf(testSession(1, { archived: true })).pills).toEqual([
      { text: 'archived', tone: 'neutral', signalsMarker: false }
    ])
  })

  it('shows a stopped teammate as a neutral pill', () => {
    const mate = testSession(2, { team: testTeammateTeam(testRef(9), true) })

    expect(notesOf(mate).pills.map((pill) => [pill.text, pill.tone])).toEqual([
      ['stopped', 'neutral']
    ])
  })

  it('shows a plan limit as a warning pill', () => {
    const pills = notesOf(
      testSession(1, { limitHit: { window: 'fiveHour', resetsAtMs: NOW - 1 } })
    ).pills

    expect(pills.map((pill) => [pill.text, pill.tone])).toEqual([['hit 5-hour limit', 'warning']])
  })

  it('gives tool errors and agent kills the error tone and compactions the warning tone', () => {
    const pills = notesOf(
      testSession(1, {
        signals: { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 2, compactions: 1, agentsKilled: 1 }
      })
    ).pills

    expect(pills.map((pill) => pill.tone)).toEqual(['error', 'warning', 'error'])
  })

  it('puts the signals marker on the last signal pill of a partial set only', () => {
    const pills = notesOf(
      testSession(1, {
        archived: true,
        signals: { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 2, compactions: 1, partial: true }
      })
    ).pills

    expect(pills.map((pill) => pill.signalsMarker)).toEqual([false, false, true])
  })

  it('keeps the folder of a session from another folder as a muted note, not a pill', () => {
    const notes = notesOf(testSession(1, { projectDirName: '-other' }))

    expect(notes).toEqual({ pills: [], meta: ['in -other'] })
  })
})
