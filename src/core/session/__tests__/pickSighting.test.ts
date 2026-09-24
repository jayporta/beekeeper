import { describe, expect, it } from 'vitest'
import { pickSighting } from '../pickSighting'
import { buildSighting } from '../testSpawnFixtures'

describe('pickSighting', () => {
  it('does not borrow a named branch first seen after the start', () => {
    const timeline = [
      buildSighting('feat/x', { cwd: '/a', timestamp: 100 }),
      buildSighting('HEAD', { cwd: '/a', timestamp: 30 })
    ]

    expect(pickSighting(timeline, 50)).toEqual({ cwd: '/a', baseBranch: undefined })
  })

  it('keeps scanning past a later-dated named entry to an earlier qualifying one', () => {
    const timeline = [
      buildSighting('feat/a', { cwd: '/a', timestamp: 10 }),
      buildSighting('feat/x', { cwd: '/a', timestamp: 100 }),
      buildSighting('HEAD', { cwd: '/a', timestamp: 30 })
    ]

    expect(pickSighting(timeline, 50)).toEqual({ cwd: '/a', baseBranch: 'feat/a' })
  })

  it('borrows the nearest earlier named branch whatever its timestamp when the start is unknown', () => {
    const timeline = [
      buildSighting('feat/x', { cwd: '/a', timestamp: 100 }),
      buildSighting('HEAD', { cwd: '/a', timestamp: 30 })
    ]

    expect(pickSighting(timeline, undefined)).toEqual({ cwd: '/a', baseBranch: 'feat/x' })
  })

  it('skips an undated entry as the pick when the start is known', () => {
    const timeline = [
      buildSighting('feat/a', { cwd: '/a', timestamp: 10 }),
      buildSighting('feat/b', { cwd: '/a', timestamp: undefined })
    ]

    expect(pickSighting(timeline, 50)).toEqual({ cwd: '/a', baseBranch: 'feat/a' })
  })

  it('picks an undated entry when the start is unknown', () => {
    const timeline = [
      buildSighting('feat/a', { cwd: '/a', timestamp: 10 }),
      buildSighting('feat/b', { cwd: '/a', timestamp: undefined })
    ]

    expect(pickSighting(timeline, undefined)).toEqual({ cwd: '/a', baseBranch: 'feat/b' })
  })

  it('does not borrow an undated named entry when the start is known', () => {
    const timeline = [
      buildSighting('feat/x', { cwd: '/a', timestamp: undefined }),
      buildSighting('HEAD', { cwd: '/a', timestamp: 30 })
    ]

    expect(pickSighting(timeline, 50)).toEqual({ cwd: '/a', baseBranch: undefined })
  })

  it('borrows an undated named entry when the start is unknown', () => {
    const timeline = [
      buildSighting('feat/x', { cwd: '/a', timestamp: undefined }),
      buildSighting('HEAD', { cwd: '/a', timestamp: 30 })
    ]

    expect(pickSighting(timeline, undefined)).toEqual({ cwd: '/a', baseBranch: 'feat/x' })
  })
})
