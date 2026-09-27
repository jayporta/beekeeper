import { describe, expect, it } from 'vitest'
import { MAX_TEAMMATE_ENTRIES, collect } from '../testTeammateCollect'
import { buildTaskStopRecord, buildTaskStopResultRecord } from '../testTeammateFixtures'

describe('createTeammateSpawnObserver stop cap', () => {
  it('flags truncated when a genuine stop is dropped before an excluding result arrives', () => {
    const others = Array.from({ length: MAX_TEAMMATE_ENTRIES - 1 }, (_, index) =>
      buildTaskStopRecord({ taskId: `other-${index}`, toolUseId: `toolu_${index}` })
    )
    const result = collect([
      buildTaskStopRecord({ toolUseId: 'toolu_bash' }),
      ...others,
      buildTaskStopRecord({ toolUseId: 'toolu_real' }),
      buildTaskStopResultRecord('local_bash', 'toolu_bash')
    ])

    expect([result.stops.some((stop) => stop.agentName === 'scout'), result.truncated]).toEqual([
      false,
      true
    ])
  })

  it('flags truncated when excluded stops fill the cap and a genuine stop is dropped', () => {
    const excluded = Array.from({ length: MAX_TEAMMATE_ENTRIES }, (_, index) => [
      buildTaskStopRecord({ toolUseId: `toolu_${index}` }),
      buildTaskStopResultRecord('local_bash', `toolu_${index}`)
    ]).flat()
    const result = collect([
      ...excluded,
      buildTaskStopRecord({ toolUseId: 'toolu_real' }),
      buildTaskStopResultRecord('in_process_teammate', 'toolu_real')
    ])

    expect([result.stops, result.truncated]).toEqual([[], true])
  })

  it('lists one stop for repeats past the cap and flags truncated, over-reporting rather than risk hiding a drop', () => {
    const records = Array.from({ length: MAX_TEAMMATE_ENTRIES + 5 }, () => buildTaskStopRecord())
    const result = collect(records)

    expect([result.stops.length, result.truncated]).toEqual([1, true])
  })

  it('caps stops and sets truncated', () => {
    const records = Array.from({ length: MAX_TEAMMATE_ENTRIES + 1 }, (_, index) =>
      buildTaskStopRecord({ taskId: `agent-${index}` })
    )
    const result = collect(records)

    expect([result.stops.length, result.truncated]).toEqual([MAX_TEAMMATE_ENTRIES, true])
  })
})
