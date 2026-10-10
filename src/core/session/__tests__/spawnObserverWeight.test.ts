import { describe, expect, it } from 'vitest'
import { createSpawnObserver, SPAWN_ENTRY_OVERHEAD } from '../spawnObserver'
import { buildBranchRecord, buildSpawnRecord, observeAll } from '../testSpawnFixtures'

describe('createSpawnObserver weight', () => {
  it('is zero before any record', () => {
    expect(createSpawnObserver().weight()).toBe(0)
  })

  it('charges the first cwd it saw, once', () => {
    const observer = observeAll([
      { type: 'user', cwd: '/work' },
      { type: 'user', cwd: '/other' }
    ])

    expect(observer.weight()).toBe('/work'.length)
  })

  it('charges a spawn for its tool call id, cwd and base branch, beyond the sightings', () => {
    const withoutSpawn = observeAll([buildBranchRecord('feat/x', '/work')])
    const withSpawn = observeAll([
      buildSpawnRecord({ toolUseIds: ['toolu_1'], cwd: '/work', gitBranch: 'feat/x' })
    ])

    expect(withSpawn.weight() - withoutSpawn.weight()).toBe(
      SPAWN_ENTRY_OVERHEAD + 'toolu_1'.length + '/work'.length + 'feat/x'.length
    )
  })

  it('charges every spawn a record makes', () => {
    const one = observeAll([buildSpawnRecord({ toolUseIds: ['a'] })])
    const two = observeAll([buildSpawnRecord({ toolUseIds: ['a', 'b'] })])

    expect(two.weight() - one.weight()).toBe(
      SPAWN_ENTRY_OVERHEAD + 'b'.length + '/repo'.length + 'main'.length
    )
  })

  it('does not charge a repeated tool call id again', () => {
    const once = observeAll([buildSpawnRecord({ toolUseIds: ['a'] })])
    const twice = observeAll([
      buildSpawnRecord({ toolUseIds: ['a'] }),
      buildSpawnRecord({ toolUseIds: ['a'] })
    ])

    expect(twice.weight()).toBe(once.weight())
  })

  it('charges a timeline entry and the named branch of its cwd', () => {
    const observer = observeAll([buildBranchRecord('feat/x', '/work')])

    // The first cwd, a timeline entry (branch and cwd), and the cwd's named branch.
    expect(observer.weight()).toBe(
      '/work'.length +
        (SPAWN_ENTRY_OVERHEAD + 'feat/x'.length + '/work'.length) +
        (SPAWN_ENTRY_OVERHEAD + '/work'.length + 'feat/x'.length)
    )
  })

  it('stops charging the timeline once it overflows and is emptied, keeping the spawns', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 2 })
    observer.observe(buildSpawnRecord({ toolUseIds: ['a'], cwd: '/one', gitBranch: 'b' }))
    observer.observe(buildBranchRecord('c', '/two'))
    observer.observe(buildBranchRecord('d', '/three'))

    expect(observer.weight()).toBe(
      '/one'.length + (SPAWN_ENTRY_OVERHEAD + 'a'.length + '/one'.length + 'b'.length)
    )
  })
})
