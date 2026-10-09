import { afterEach, describe, expect, it } from 'vitest'
import { useLiveUpdatesStore } from '../useLiveUpdatesStore'

afterEach(() => {
  useLiveUpdatesStore.setState({ paused: false, unavailable: false })
})

describe('useLiveUpdatesStore', () => {
  it('starts running and available', () => {
    expect(useLiveUpdatesStore.getState()).toMatchObject({ paused: false, unavailable: false })
  })

  it('pauses and resumes', () => {
    useLiveUpdatesStore.getState().setPaused(true)
    expect(useLiveUpdatesStore.getState().paused).toBe(true)

    useLiveUpdatesStore.getState().setPaused(false)
    expect(useLiveUpdatesStore.getState().paused).toBe(false)
  })

  it('marks live updates unavailable without touching paused', () => {
    useLiveUpdatesStore.getState().markUnavailable()
    expect(useLiveUpdatesStore.getState()).toMatchObject({ paused: false, unavailable: true })
  })
})
