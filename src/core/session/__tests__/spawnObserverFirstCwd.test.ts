import { describe, expect, it } from 'vitest'
import { buildBranchRecord, buildSpawnRecord, observeAll } from '../testSpawnFixtures'

describe('createSpawnObserver first cwd', () => {
  it('reports the cwd of the first record that has a valid one', () => {
    const { firstCwd } = observeAll([
      { ...buildBranchRecord('main'), cwd: undefined },
      buildBranchRecord('main', '/first'),
      buildBranchRecord('main', '/second')
    ]).result()

    expect(firstCwd).toBe('/first')
  })

  it('skips a relative cwd', () => {
    const { firstCwd } = observeAll([
      buildBranchRecord('main', 'relative/dir'),
      buildBranchRecord('main', '/abs')
    ]).result()

    expect(firstCwd).toBe('/abs')
  })

  it('skips a cwd longer than 4096 characters', () => {
    const { firstCwd } = observeAll([buildBranchRecord('main', `/${'a'.repeat(4096)}`)]).result()

    expect(firstCwd).toBeUndefined()
  })

  it('is undefined when no record has a cwd', () => {
    const { firstCwd } = observeAll([buildSpawnRecord({ cwd: undefined })]).result()

    expect(firstCwd).toBeUndefined()
  })
})
