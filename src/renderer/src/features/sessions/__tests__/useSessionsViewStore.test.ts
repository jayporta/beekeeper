import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSessionsViewStore } from '../state/useSessionsViewStore'

afterEach(() => {
  useSessionsViewStore.setState({ query: '', expanded: new Set() })
})

describe('useSessionsViewStore collapseAll', () => {
  it('collapses every expanded lead', () => {
    useSessionsViewStore.getState().toggle('a')
    useSessionsViewStore.getState().toggle('b')

    useSessionsViewStore.getState().collapseAll()

    expect(useSessionsViewStore.getState().expanded.size).toBe(0)
  })

  it('does nothing when nothing is expanded: same set, no store update', () => {
    const before = useSessionsViewStore.getState().expanded
    const listener = vi.fn()
    const unsubscribe = useSessionsViewStore.subscribe(listener)

    useSessionsViewStore.getState().collapseAll()
    unsubscribe()

    expect(useSessionsViewStore.getState().expanded).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })
})
