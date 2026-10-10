import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { groupSessionRows } from '../groupSessionRows'
import type { SessionRow } from '../sessionRow'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../testSessionFixtures'
import { testSessionsT } from '../testSessionsT'
import { useReusedRows } from '../useReusedRows'

const group = (items: readonly SessionListItemDto[]): readonly SessionRow[] =>
  groupSessionRows(items, testSessionsT)

/** Renders the hook on the grouped `first` items and returns a function that regroups `next` and renders again. */
function renderRows(first: readonly SessionListItemDto[]): {
  initial: readonly SessionRow[]
  rerenderWith: (next: readonly SessionListItemDto[]) => readonly SessionRow[]
} {
  const { result, rerender } = renderHook(({ rows }) => useReusedRows(rows), {
    initialProps: { rows: group(first) }
  })
  return {
    initial: result.current,
    rerenderWith: (next) => {
      rerender({ rows: group(next) })
      return result.current
    }
  }
}

/** The top-level row for a session, found by its item's id. */
const rowOf = (rows: readonly SessionRow[], item: SessionListItemDto): SessionRow | undefined =>
  rows.find((row) => row.item.sessionId === item.sessionId)

const lead = testSession(1, { latestMs: 5, team: testLeadTeam([testRef(2)]) })
const teammate = testSession(2, {
  role: testAgentRole('a', 't'),
  team: testTeammateTeam(testRef(1))
})
const solo = testSession(3, { title: 'Solo' })

describe('useReusedRows', () => {
  it('returns the earlier row objects when the regrouped items are the same objects', () => {
    const items = [lead, teammate, solo]
    const { initial, rerenderWith } = renderRows(items)

    const next = rerenderWith(items)

    expect(rowOf(next, lead)).toBe(rowOf(initial, lead))
    expect(rowOf(next, solo)).toBe(rowOf(initial, solo))
  })

  it('returns the earlier row when an equal item arrives as a new object', () => {
    const { initial, rerenderWith } = renderRows([lead, teammate, solo])

    const next = rerenderWith([lead, teammate, structuredClone(solo)])

    expect(rowOf(next, solo)).toBe(rowOf(initial, solo))
  })

  it('returns a new row for a changed item and keeps the others', () => {
    const { initial, rerenderWith } = renderRows([lead, teammate, solo])

    const next = rerenderWith([lead, teammate, testSession(3, { title: 'Renamed' })])

    expect(rowOf(next, lead)).toBe(rowOf(initial, lead))
    expect(rowOf(next, solo)).not.toBe(rowOf(initial, solo))
    expect(rowOf(next, solo)?.label.text).toBe('Renamed')
  })

  it('returns a new lead row, holding its new teammate row, when only the teammate changed', () => {
    const { initial, rerenderWith } = renderRows([lead, teammate, solo])

    const renamed = testSession(2, {
      role: testAgentRole('b', 't'),
      team: testTeammateTeam(testRef(1))
    })

    const next = rerenderWith([lead, renamed, solo])

    expect(rowOf(next, lead)).not.toBe(rowOf(initial, lead))
    expect(rowOf(next, lead)?.teammates[0]?.item).toBe(renamed)
    expect(rowOf(next, solo)).toBe(rowOf(initial, solo))
  })

  it('returns the rows as given on first render', () => {
    const rows = group([solo])
    const { result } = renderHook(() => useReusedRows(rows))

    expect(result.current).toBe(rows)
  })
})
