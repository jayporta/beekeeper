import { describe, expect, it } from 'vitest'
import { createSpawnObserver } from '../spawnObserver'
import { buildBranchRecord, buildSpawnRecord } from '../testSpawnFixtures'

function observeAll(
  records: readonly Record<string, unknown>[]
): ReturnType<typeof createSpawnObserver> {
  const observer = createSpawnObserver()
  for (const record of records) observer.observe(record)
  return observer
}

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

  it('reports the last non-HEAD branch with its own cwd', () => {
    const observer = observeAll([
      buildBranchRecord('one', '/repo-one'),
      buildBranchRecord('two', '/repo-two'),
      buildBranchRecord('HEAD', '/repo-three')
    ])

    expect(observer.result().lastBranch).toEqual({ branch: 'two', cwd: '/repo-two' })
  })

  it('ignores a branch whose record has no valid cwd', () => {
    const observer = observeAll([
      buildBranchRecord('one', '/repo-one'),
      buildBranchRecord('two', 'rel')
    ])

    expect(observer.result().lastBranch).toEqual({ branch: 'one', cwd: '/repo-one' })
  })

  it('has no last branch when none was named', () => {
    expect(observeAll([buildBranchRecord('HEAD')]).result().lastBranch).toBeUndefined()
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
})
