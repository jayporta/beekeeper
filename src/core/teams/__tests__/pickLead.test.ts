import { describe, expect, it } from 'vitest'
import { LEAD_END_GRACE_MS, pickLead } from '../pickLead'
import { testActivity, testLead, testRef } from '../testTeamFixtures'

describe('pickLead', () => {
  it('picks the candidate whose span contains the teammate start', () => {
    const early = testLead(testRef('p', 'early'), { activity: testActivity(0, 100) })
    const containing = testLead(testRef('p', 'containing'), { activity: testActivity(100, 200) })

    expect(pickLead([early, containing], 150)).toBe(containing)
  })

  it('prefers a containing candidate over one that started later but ended before the teammate start', () => {
    const wide = testLead(testRef('p', 'a'), { activity: testActivity(0, 200) })
    const narrow = testLead(testRef('p', 'b'), { activity: testActivity(50, 100) })

    expect(pickLead([narrow, wide], 150)).toBe(wide)
  })

  it('picks the latest candidate that started at or before the teammate start, when none contains it', () => {
    const startedEarly = testLead(testRef('p', 'earlier'), { activity: testActivity(0, 50) })
    const startedLater = testLead(testRef('p', 'later'), { activity: testActivity(100, 150) })
    const startedAfter = testLead(testRef('p', 'after'), { activity: testActivity(500, 600) })

    expect(pickLead([startedEarly, startedLater, startedAfter], 300)).toBe(startedLater)
  })

  it('picks the earliest candidate when none started at or before the teammate start', () => {
    const later = testLead(testRef('p', 'later'), { activity: testActivity(500, 600) })
    const earliest = testLead(testRef('p', 'earliest'), { activity: testActivity(100, 200) })

    expect(pickLead([later, earliest], 0)).toBe(earliest)
  })

  it('picks the earliest candidate when the teammate has no recorded start', () => {
    const later = testLead(testRef('p', 'later'), { activity: testActivity(500, 600) })
    const earliest = testLead(testRef('p', 'earliest'), { activity: testActivity(100, 200) })

    expect(pickLead([later, earliest], null)).toBe(earliest)
  })

  it('breaks a tie between two containing candidates by ref', () => {
    const b = testLead(testRef('p', 'b'), { activity: testActivity(0, 200) })
    const a = testLead(testRef('p', 'a'), { activity: testActivity(0, 200) })

    expect(pickLead([b, a], 100)).toBe(a)
  })

  it('breaks a tie between candidates with no activity by ref', () => {
    const b = testLead(testRef('p', 'b'))
    const a = testLead(testRef('p', 'a'))

    expect(pickLead([b, a], null)).toBe(a)
  })

  it('returns null when the only candidate ended long before the teammate started', () => {
    const expired = testLead(testRef('p', 'expired'), { activity: testActivity(0, 1_000) })

    expect(pickLead([expired], 100_000)).toBeNull()
  })

  it('picks an active candidate over an expired one that started at or before the teammate', () => {
    const expired = testLead(testRef('p', 'expired'), { activity: testActivity(0, 1_000) })
    const active = testLead(testRef('p', 'active'), { activity: testActivity(200_000, 300_000) })

    expect(pickLead([expired, active], 100_000)).toBe(active)
  })

  it('still picks a candidate whose activity ended exactly the grace period before the teammate', () => {
    const justEnded = testLead(testRef('p', 'ended'), {
      activity: testActivity(0, 1_000)
    })

    expect(pickLead([justEnded], 1_000 + LEAD_END_GRACE_MS)).toBe(justEnded)
  })

  it('drops a candidate whose activity ended one millisecond past the grace period', () => {
    const expired = testLead(testRef('p', 'expired'), { activity: testActivity(0, 1_000) })

    expect(pickLead([expired], 1_000 + LEAD_END_GRACE_MS + 1)).toBeNull()
  })

  it('keeps a candidate with no activity eligible however late the teammate started', () => {
    const noActivity = testLead(testRef('p', 'quiet'))

    expect(pickLead([noActivity], 1_000_000)).toBe(noActivity)
  })

  it('throws when given no candidates', () => {
    expect(() => pickLead([], null)).toThrow()
  })
})
