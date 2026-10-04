import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_TOTALS_WINDOW, useTotalsWindowStore } from '../useTotalsWindowStore'

afterEach(() => {
  useTotalsWindowStore.setState({ window: DEFAULT_TOTALS_WINDOW })
})

describe('useTotalsWindowStore', () => {
  it('starts at 7 days', () => {
    expect(useTotalsWindowStore.getState().window).toBe('7d')
  })

  it('changes the window', () => {
    useTotalsWindowStore.getState().setWindow('30d')

    expect(useTotalsWindowStore.getState().window).toBe('30d')
  })
})
