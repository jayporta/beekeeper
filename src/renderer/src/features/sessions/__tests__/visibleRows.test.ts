import { describe, expect, it } from 'vitest'
import { groupSessionRows } from '../groupSessionRows'
import { testLeadTeam, testRef, testSession, testTeammateTeam } from '../testSessionFixtures'
import { testSessionsT } from '../testSessionsT'
import { visibleRows } from '../visibleRows'

const lead = testSession(1, { latestMs: 9, team: testLeadTeam([testRef(2)]) })
const mate = testSession(2, { team: testTeammateTeam(testRef(1)) })
const rows = groupSessionRows([lead, mate], testSessionsT)

describe('visibleRows', () => {
  it('shows only top-level rows when nothing is expanded', () => {
    expect(
      visibleRows({ rows, expanded: new Set(), searching: false }).map((r) => r.nested)
    ).toEqual([false])
  })

  it('follows an expanded lead with its teammates', () => {
    const visible = visibleRows({ rows, expanded: new Set([rows[0]?.key ?? '']), searching: false })

    expect(visible.map((r) => r.nested)).toEqual([false, true])
  })

  it('names the lead on each nested row and on no top-level row', () => {
    const visible = visibleRows({ rows, expanded: new Set([rows[0]?.key ?? '']), searching: false })

    expect(visible.map((r) => r.leadLabel)).toEqual([null, 'Untitled session'])
  })

  it('shows teammates under every lead while searching, expanded or not', () => {
    expect(
      visibleRows({ rows, expanded: new Set(), searching: true }).map((r) => r.nested)
    ).toEqual([false, true])
  })
})
