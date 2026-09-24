import { describe, expect, it } from 'vitest'
import { createSpawnObserver } from '../spawnObserver'
import { buildBranchRecord, buildSpawnRecord, observeAll, stampRecord } from '../testSpawnFixtures'

describe('createSpawnObserver', () => {
  it('records the cwd and branch of the record holding an Agent tool_use', () => {
    const observer = observeAll([
      buildSpawnRecord({ toolUseIds: ['a', 'b'], cwd: '/work', gitBranch: 'feat/x' })
    ])

    expect(observer.result().spawns.get('a')).toEqual({ cwd: '/work', baseBranch: 'feat/x' })
    expect(observer.result().spawns.get('b')).toEqual({ cwd: '/work', baseBranch: 'feat/x' })
  })

  it('ignores tool_use blocks that are not Agent', () => {
    const observer = observeAll([buildSpawnRecord({ toolName: 'Bash' })])

    expect(observer.result().spawns.size).toBe(0)
  })

  it('takes the last named branch seen earlier when the spawn says HEAD', () => {
    const observer = observeAll([
      buildBranchRecord('feat/earlier'),
      buildBranchRecord('HEAD'),
      buildSpawnRecord({ gitBranch: 'HEAD' })
    ])

    expect(observer.result().spawns.get('toolu_spawn')).toEqual({
      cwd: '/repo',
      baseBranch: 'feat/earlier'
    })
  })

  it('has no base when the spawn says HEAD and no branch was named before it', () => {
    const observer = observeAll([
      buildSpawnRecord({ gitBranch: 'HEAD' }),
      buildBranchRecord('feat/later')
    ])

    expect(observer.result().spawns.get('toolu_spawn')).toEqual({
      cwd: '/repo',
      baseBranch: undefined
    })
  })

  it.each([
    ['missing', undefined],
    ['relative', 'repo'],
    ['oversized', '/' + 'a'.repeat(4096)],
    ['not a string', 5]
  ])('records no spawn when the cwd is %s', (_label, cwd) => {
    const observer = observeAll([buildSpawnRecord({ cwd })])

    expect(observer.result().spawns.size).toBe(0)
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['oversized', 'b'.repeat(256)],
    ['not a string', 5]
  ])('records the spawn with no base when the branch is %s', (_label, gitBranch) => {
    const observer = observeAll([buildSpawnRecord({ gitBranch })])

    expect(observer.result().spawns.get('toolu_spawn')).toEqual({
      cwd: '/repo',
      baseBranch: undefined
    })
  })

  it('does not let an invalid branch fall back to an earlier one', () => {
    const observer = observeAll([
      buildBranchRecord('feat/earlier'),
      buildSpawnRecord({ gitBranch: '' })
    ])

    expect(observer.result().spawns.get('toolu_spawn')?.baseBranch).toBeUndefined()
  })

  it('keeps the first entry when a tool_use id repeats', () => {
    const observer = observeAll([
      buildSpawnRecord({ cwd: '/first', gitBranch: 'feat/first' }),
      buildSpawnRecord({ cwd: '/second', gitBranch: 'feat/second' })
    ])

    expect(observer.result().spawns.get('toolu_spawn')).toEqual({
      cwd: '/first',
      baseBranch: 'feat/first'
    })
  })

  it('gives a HEAD spawn no base when the last named branch was in another cwd', () => {
    const observer = observeAll([
      buildBranchRecord('feat/other', '/other-repo'),
      buildSpawnRecord({ cwd: '/repo', gitBranch: 'HEAD' })
    ])

    expect(observer.result().spawns.get('toolu_spawn')).toEqual({
      cwd: '/repo',
      baseBranch: undefined
    })
  })

  it('borrows the same-cwd branch for a HEAD spawn even after another cwd named one', () => {
    const observer = observeAll([
      buildBranchRecord('feat/x', '/a'),
      buildBranchRecord('feat/y', '/b'),
      buildSpawnRecord({ cwd: '/a', gitBranch: 'HEAD' })
    ])

    expect(observer.result().spawns.get('toolu_spawn')?.baseBranch).toBe('feat/x')
  })

  it('gives a HEAD spawn no base once the timeline has overflowed', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 1 })
    observer.observe(stampRecord(buildBranchRecord('a'), 0))
    observer.observe(stampRecord(buildBranchRecord('b'), 1000))
    observer.observe(buildSpawnRecord({ gitBranch: 'HEAD' }))

    expect(observer.result().spawns.get('toolu_spawn')?.baseBranch).toBeUndefined()
  })

  it('counts undated named cwds toward the cap, giving a later HEAD spawn no base', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 2 })
    for (const cwd of ['/a', '/b', '/c']) {
      observer.observe({ ...buildBranchRecord('named', cwd), timestamp: undefined })
    }
    observer.observe(buildSpawnRecord({ cwd: '/c', gitBranch: 'HEAD' }))

    expect(observer.result().spawns.get('toolu_spawn')?.baseBranch).toBeUndefined()
  })

  it('keeps a HEAD spawn base when its own entry brings the timeline to the cap', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 3 })
    observer.observe(stampRecord(buildBranchRecord('a'), 0))
    observer.observe(stampRecord(buildBranchRecord('b'), 1000))
    observer.observe(buildSpawnRecord({ gitBranch: 'HEAD' }))

    expect(observer.result().spawns.get('toolu_spawn')?.baseBranch).toBe('b')
  })

  it('gives a HEAD spawn no base when its own entry pushes the timeline one over the cap', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 2 })
    observer.observe(stampRecord(buildBranchRecord('a'), 0))
    observer.observe(stampRecord(buildBranchRecord('b'), 1000))
    observer.observe(buildSpawnRecord({ gitBranch: 'HEAD' }))

    expect(observer.result().spawns.get('toolu_spawn')?.baseBranch).toBeUndefined()
  })
})
