import { describe, expect, it } from 'vitest'
import { createTeammateSpawnObserver, TEAMMATE_ENTRY_OVERHEAD } from '../teammateSpawnObserver'
import {
  buildTaskStopRecord,
  buildTaskStopResultRecord,
  buildTeammateSpawnRecord
} from '../testTeammateFixtures'

function observed(records: readonly Record<string, unknown>[]): number {
  const observer = createTeammateSpawnObserver()
  for (const record of records) observer.observe(record)
  return observer.weight()
}

describe('createTeammateSpawnObserver weight', () => {
  it('is zero before any spawn or stop', () => {
    expect(observed([])).toBe(0)
  })

  it('charges a spawn for its entry, its team lookup, its strings and its dedupe key', () => {
    const weight = observed([
      buildTeammateSpawnRecord({
        name: 'scout',
        team: 'team-1',
        agentType: 'Explore',
        toolUseId: 'toolu_spawn'
      })
    ])

    // Entry: name, team, type, tool call id, and the `team\0name` key.
    const entry = TEAMMATE_ENTRY_OVERHEAD + 5 + 6 + 7 + 11 + (6 + 1 + 5)
    // Team lookup: the name and its latest team.
    const lookup = TEAMMATE_ENTRY_OVERHEAD + 5 + 6
    expect(weight).toBe(entry + lookup)
  })

  it('charges a stop for its candidate and the call awaiting a result', () => {
    const weight = observed([buildTaskStopRecord({ taskId: 'scout@team-1', toolUseId: 'toolu_1' })])

    // Candidate: the name and the stated team. Pending call: its id.
    const candidate = TEAMMATE_ENTRY_OVERHEAD + 5 + 6
    const pending = TEAMMATE_ENTRY_OVERHEAD + 7
    expect(weight).toBe(candidate + pending)
  })

  it('stops charging a call once its result has arrived', () => {
    const awaiting = observed([buildTaskStopRecord({ taskId: 'scout', toolUseId: 'toolu_1' })])
    const answered = observed([
      buildTaskStopRecord({ taskId: 'scout', toolUseId: 'toolu_1' }),
      buildTaskStopResultRecord('in_process_teammate', 'toolu_1')
    ])

    expect(answered).toBe(awaiting - (TEAMMATE_ENTRY_OVERHEAD + 7))
  })

  it('does not charge a repeated spawn again', () => {
    const once = observed([buildTeammateSpawnRecord()])
    const twice = observed([buildTeammateSpawnRecord(), buildTeammateSpawnRecord()])

    expect(twice).toBe(once)
  })
})
