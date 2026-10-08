import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSettledAnnouncement } from '../useSettledAnnouncement'

interface Props {
  scope: string
  settled: boolean
  outcome: 'good' | 'bad'
}

const say = (outcome: 'good' | 'bad', scope: string): string => `${scope} was ${outcome}`

function render(initial: Props): ReturnType<typeof renderHook<string, Props>> {
  return renderHook((props: Props) => useSettledAnnouncement({ ...props, say }), {
    initialProps: initial
  })
}

describe('useSettledAnnouncement', () => {
  it('says nothing while the data is unsettled', () => {
    const { result } = render({ scope: 'a', settled: false, outcome: 'good' })

    expect(result.current).toBe('')
  })

  it('says what the data came to once it settles', async () => {
    const { result, rerender } = render({ scope: 'a', settled: false, outcome: 'good' })

    rerender({ scope: 'a', settled: true, outcome: 'good' })

    await waitFor(() => {
      expect(result.current).toBe('a was good')
    })
  })

  it('says nothing for data that was already settled when it opened', () => {
    const { result } = render({ scope: 'a', settled: true, outcome: 'good' })

    expect(result.current).toBe('')
  })

  it('says it again when the outcome changes while settled', async () => {
    const { result, rerender } = render({ scope: 'a', settled: true, outcome: 'good' })

    rerender({ scope: 'a', settled: true, outcome: 'bad' })

    await waitFor(() => {
      expect(result.current).toBe('a was bad')
    })
  })

  it('says it again after the scope changes and the new data settles', async () => {
    const { result, rerender } = render({ scope: 'a', settled: true, outcome: 'good' })

    rerender({ scope: 'b', settled: false, outcome: 'good' })
    expect(result.current).toBe('')
    rerender({ scope: 'b', settled: true, outcome: 'good' })

    await waitFor(() => {
      expect(result.current).toBe('b was good')
    })
  })

  it('says it again when data settles anew after loading, even to the same outcome', async () => {
    const { result, rerender } = render({ scope: 'a', settled: true, outcome: 'good' })
    rerender({ scope: 'a', settled: false, outcome: 'good' })

    rerender({ scope: 'a', settled: true, outcome: 'good' })

    await waitFor(() => {
      expect(result.current).toBe('a was good')
    })
  })
})
