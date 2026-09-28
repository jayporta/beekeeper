import { describe, expect, it } from 'vitest'
import { spawnPairOrder } from '../spawnPairOrder'
import { foldTeamKey } from '../teamKey'
import { testSpawn } from '../testTeamFixtures'

describe('spawnPairOrder', () => {
  it('maps each folded pair to the index of its first spawn', () => {
    const order = spawnPairOrder([
      testSpawn('alpha', 'team'),
      testSpawn('beta', 'team'),
      testSpawn('ALPHA', 'Team')
    ])

    expect([...order]).toEqual([
      [foldTeamKey('team', 'alpha'), 0],
      [foldTeamKey('team', 'beta'), 1]
    ])
  })

  it('skips a spawn that named no team but still counts its index', () => {
    const order = spawnPairOrder([testSpawn('ghost', null), testSpawn('alpha', 'team')])

    expect([...order]).toEqual([[foldTeamKey('team', 'alpha'), 1]])
  })

  it('returns an empty map for no spawns', () => {
    expect(spawnPairOrder([]).size).toBe(0)
  })
})
