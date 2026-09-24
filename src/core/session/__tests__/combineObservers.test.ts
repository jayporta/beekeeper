import { describe, expect, it } from 'vitest'
import { combineObservers } from '../combineObservers'

describe('combineObservers', () => {
  it('feeds each record to every observer in order', () => {
    const calls: string[] = []
    const observe = combineObservers(
      (r) => calls.push(`a:${String(r.n)}`),
      (r) => calls.push(`b:${String(r.n)}`)
    )

    observe({ n: 1 })
    observe({ n: 2 })

    expect(calls).toEqual(['a:1', 'b:1', 'a:2', 'b:2'])
  })
})
