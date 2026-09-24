import { describe, expect, it } from 'vitest'
import { createSpawnObserver } from '../spawnObserver'
import { BASE_TIME, buildBranchRecord, observeAll, stampRecord } from '../testSpawnFixtures'

describe('createSpawnObserver timeline', () => {
  it('appends a timeline entry only when the branch or cwd changes, keeping the run start', () => {
    const observer = observeAll([
      stampRecord(buildBranchRecord('one', '/a'), 0),
      stampRecord(buildBranchRecord('one', '/a'), 1000),
      stampRecord(buildBranchRecord('HEAD', '/a'), 2000),
      stampRecord(buildBranchRecord('HEAD', '/b'), 3000)
    ])

    expect(observer.result().timeline).toEqual([
      { branch: 'one', cwd: '/a', timestamp: BASE_TIME },
      { branch: 'HEAD', cwd: '/a', timestamp: BASE_TIME + 2000 },
      { branch: 'HEAD', cwd: '/b', timestamp: BASE_TIME + 3000 }
    ])
  })

  it('records no timeline entry for a record whose cwd is not absolute', () => {
    const observer = observeAll([stampRecord(buildBranchRecord('one', 'rel'), 0)])

    expect(observer.result().timeline).toEqual([])
  })

  it('records no timeline entry for a record whose branch is empty', () => {
    const observer = observeAll([stampRecord(buildBranchRecord('', '/a'), 0)])

    expect(observer.result().timeline).toEqual([])
  })

  it('records a run with no parseable timestamp as undefined', () => {
    const observer = observeAll([
      { ...buildBranchRecord('one', '/a'), timestamp: undefined },
      stampRecord(buildBranchRecord('one', '/a'), 'not a date')
    ])

    expect(observer.result().timeline).toEqual([{ branch: 'one', cwd: '/a', timestamp: undefined }])
  })

  it('fills an undated run with the first dated record of the same run', () => {
    const observer = observeAll([
      { ...buildBranchRecord('one', '/a'), timestamp: undefined },
      stampRecord(buildBranchRecord('one', '/a'), 4000),
      stampRecord(buildBranchRecord('one', '/a'), 9000)
    ])

    expect(observer.result().timeline).toEqual([
      { branch: 'one', cwd: '/a', timestamp: BASE_TIME + 4000 }
    ])
  })

  it('does not fill an undated run from a dated record with no valid branch', () => {
    const observer = observeAll([
      { ...buildBranchRecord('one', '/a'), timestamp: undefined },
      stampRecord(buildBranchRecord('', '/a'), 4000)
    ])

    expect(observer.result().timeline).toEqual([{ branch: 'one', cwd: '/a', timestamp: undefined }])
  })

  it('leaves an undated run undefined when the next dated record starts another run', () => {
    const observer = observeAll([
      { ...buildBranchRecord('one', '/a'), timestamp: undefined },
      stampRecord(buildBranchRecord('two', '/a'), 4000)
    ])

    expect(observer.result().timeline).toEqual([
      { branch: 'one', cwd: '/a', timestamp: undefined },
      { branch: 'two', cwd: '/a', timestamp: BASE_TIME + 4000 }
    ])
  })

  it('takes the start from the first timestamped record when the first has none', () => {
    const observer = observeAll([
      { type: 'fork-context-ref' },
      stampRecord(buildBranchRecord('one'), 0),
      stampRecord(buildBranchRecord('two'), 5000)
    ])

    expect(observer.result().startedAt).toBe(BASE_TIME)
  })

  it('has no start when no record carries a timestamp', () => {
    expect(
      observeAll([{ ...buildBranchRecord('one'), timestamp: undefined }]).result().startedAt
    ).toBeUndefined()
  })

  it('adds an entry with the next timestamp when the changed record has none', () => {
    const observer = observeAll([
      stampRecord(buildBranchRecord('one'), 0),
      { ...buildBranchRecord('two'), timestamp: undefined },
      stampRecord(buildBranchRecord('two'), 7000)
    ])

    expect(observer.result().timeline.map((e) => [e.branch, e.timestamp])).toEqual([
      ['one', BASE_TIME],
      ['two', BASE_TIME + 7000]
    ])
  })

  it('takes the start from a first record that has a timestamp but no cwd or branch', () => {
    const observer = observeAll([
      stampRecord({ type: 'summary' }, 1000),
      stampRecord(buildBranchRecord('one'), 5000)
    ])

    expect(observer.result().startedAt).toBe(BASE_TIME + 1000)
  })

  it('empties the timeline at exactly one entry over the cap', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 2 })
    for (const [i, branch] of ['a', 'b', 'c'].entries()) {
      observer.observe(stampRecord(buildBranchRecord(branch), i * 1000))
    }

    expect(observer.result().timeline).toEqual([])
  })

  it('stops recording after the cap is exceeded', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 2 })
    for (const [i, branch] of ['a', 'b', 'c', 'd'].entries()) {
      observer.observe(stampRecord(buildBranchRecord(branch), i * 1000))
    }

    expect(observer.result().timeline).toEqual([])
  })

  it('keeps the timeline when it stays at the cap', () => {
    const observer = createSpawnObserver({ maxTimelineEntries: 2 })
    observer.observe(stampRecord(buildBranchRecord('a'), 0))
    observer.observe(stampRecord(buildBranchRecord('b'), 1000))

    expect(observer.result().timeline).toHaveLength(2)
  })
})
