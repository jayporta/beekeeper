import { describe, expect, it } from 'vitest'
import { createSpawnObserver } from '../spawnObserver'
import { buildBranchRecord, buildSpawnRecord } from '../testSpawnFixtures'

const BASE = Date.parse('2026-01-01T00:00:00.000Z')

/** Stamps a record with `BASE` plus an offset in ms, or with a raw string. */
function stamped(record: Record<string, unknown>, at: number | string): Record<string, unknown> {
  return { ...record, timestamp: typeof at === 'string' ? at : new Date(BASE + at).toISOString() }
}

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

  it('appends a timeline entry only when the branch or cwd changes, keeping the run start', () => {
    const observer = observeAll([
      stamped(buildBranchRecord('one', '/a'), 0),
      stamped(buildBranchRecord('one', '/a'), 1000),
      stamped(buildBranchRecord('HEAD', '/a'), 2000),
      stamped(buildBranchRecord('HEAD', '/b'), 3000)
    ])

    expect(observer.result().timeline).toEqual([
      { branch: 'one', cwd: '/a', timestamp: BASE },
      { branch: 'HEAD', cwd: '/a', timestamp: BASE + 2000 },
      { branch: 'HEAD', cwd: '/b', timestamp: BASE + 3000 }
    ])
  })

  it('skips records without a valid cwd, branch, or timestamp', () => {
    const observer = observeAll([
      stamped(buildBranchRecord('one', 'rel'), 0),
      stamped(buildBranchRecord('', '/a'), 0),
      { ...buildBranchRecord('two', '/a'), timestamp: undefined },
      stamped(buildBranchRecord('three', '/a'), 'not a date')
    ])

    expect(observer.result().timeline).toEqual([])
  })

  it('takes the start from the first timestamped record when the first has none', () => {
    const observer = observeAll([
      { type: 'fork-context-ref' },
      stamped(buildBranchRecord('one'), 0),
      stamped(buildBranchRecord('two'), 5000)
    ])

    expect(observer.result().startedAt).toBe(BASE)
  })

  it('has no start when no record carries a timestamp', () => {
    expect(
      observeAll([{ ...buildBranchRecord('one'), timestamp: undefined }]).result().startedAt
    ).toBeUndefined()
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

  it('adds an entry with the next timestamp when the changed record has none', () => {
    const observer = observeAll([
      stamped(buildBranchRecord('one'), 0),
      { ...buildBranchRecord('two'), timestamp: undefined },
      stamped(buildBranchRecord('two'), 7000)
    ])

    expect(observer.result().timeline.map((e) => [e.branch, e.timestamp])).toEqual([
      ['one', BASE],
      ['two', BASE + 7000]
    ])
  })

  it('takes the start from a first record that has a timestamp but no cwd or branch', () => {
    const observer = observeAll([
      stamped({ type: 'summary' }, 1000),
      stamped(buildBranchRecord('one'), 5000)
    ])

    expect(observer.result().startedAt).toBe(BASE + 1000)
  })

  it('empties the timeline at exactly one entry over the cap', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 2 })
    for (const [i, branch] of ['a', 'b', 'c'].entries()) {
      observer.observe(stamped(buildBranchRecord(branch), i * 1000))
    }

    expect(observer.result().timeline).toEqual([])
  })

  it('stops recording after the cap is exceeded', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 2 })
    for (const [i, branch] of ['a', 'b', 'c', 'd'].entries()) {
      observer.observe(stamped(buildBranchRecord(branch), i * 1000))
    }

    expect(observer.result().timeline).toEqual([])
  })

  it('gives a HEAD spawn no base once the timeline has overflowed', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 1 })
    observer.observe(stamped(buildBranchRecord('a'), 0))
    observer.observe(stamped(buildBranchRecord('b'), 1000))
    observer.observe(buildSpawnRecord({ gitBranch: 'HEAD' }))

    expect(observer.result().spawns.get('toolu_spawn')?.baseBranch).toBeUndefined()
  })

  it('gives a HEAD spawn no base once untimestamped cwds pass the cap', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 2 })
    for (const cwd of ['/a', '/b', '/repo']) {
      observer.observe({ ...buildBranchRecord('named', cwd), timestamp: undefined })
    }
    observer.observe(buildSpawnRecord({ gitBranch: 'HEAD' }))

    expect(observer.result().spawns.get('toolu_spawn')?.baseBranch).toBeUndefined()
  })

  it('keeps a HEAD spawn base when untimestamped cwds stay at the cap', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 2 })
    for (const cwd of ['/a', '/repo']) {
      observer.observe({ ...buildBranchRecord('named', cwd), timestamp: undefined })
    }
    observer.observe(buildSpawnRecord({ gitBranch: 'HEAD' }))

    expect(observer.result().spawns.get('toolu_spawn')?.baseBranch).toBe('named')
  })

  it('keeps the timeline when it stays at the cap', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 2 })
    observer.observe(stamped(buildBranchRecord('a'), 0))
    observer.observe(stamped(buildBranchRecord('b'), 1000))

    expect(observer.result().timeline).toHaveLength(2)
  })
})
