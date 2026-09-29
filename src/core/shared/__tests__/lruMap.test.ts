import { describe, expect, it } from 'vitest'
import { createLruMap } from '../lruMap'

/** A map of string values weighed by their length. */
function lengthMap(maxWeight: number): ReturnType<typeof createLruMap<string, string>> {
  return createLruMap<string, string>({ maxWeight, weigh: (value) => value.length })
}

describe('createLruMap', () => {
  it('returns a stored value and undefined for an absent key', () => {
    const map = lengthMap(10)
    map.set('a', 'xx')

    expect([map.get('a'), map.get('b')]).toEqual(['xx', undefined])
  })

  it('evicts the least recently used entry when the weight passes the bound', () => {
    const map = lengthMap(4)
    map.set('a', 'xx')
    map.set('b', 'xx')
    map.set('c', 'xx')

    expect([map.get('a'), map.get('b'), map.get('c')]).toEqual([undefined, 'xx', 'xx'])
  })

  it('evicts more than one entry when a heavy value needs the room', () => {
    const map = lengthMap(4)
    map.set('a', 'x')
    map.set('b', 'x')
    map.set('c', 'xxxx')

    expect([map.get('a'), map.get('b'), map.get('c')]).toEqual([undefined, undefined, 'xxxx'])
  })

  it('treats a get as a use, so the entry outlives one that was not read', () => {
    const map = lengthMap(4)
    map.set('a', 'xx')
    map.set('b', 'xx')
    map.get('a')
    map.set('c', 'xx')

    expect([map.get('a'), map.get('b')]).toEqual(['xx', undefined])
  })

  it('treats a set of an existing key as a use', () => {
    const map = lengthMap(4)
    map.set('a', 'xx')
    map.set('b', 'xx')
    map.set('a', 'yy')
    map.set('c', 'xx')

    expect([map.get('a'), map.get('b')]).toEqual(['yy', undefined])
  })

  it('counts a replaced value once, at its new weight', () => {
    const map = lengthMap(10)
    map.set('a', 'xxxx')
    map.set('a', 'xx')

    expect({ size: map.size, weight: map.weight }).toEqual({ size: 1, weight: 2 })
  })

  it('never lets the tracked weight pass the bound', () => {
    const map = lengthMap(5)
    const writes = [
      ['a', 'xxx'],
      ['b', 'xx'],
      ['c', 'xxxx'],
      ['d', 'x']
    ] as const
    for (const [key, value] of writes) {
      map.set(key, value)
      expect(map.weight).toBeLessThanOrEqual(5)
    }
  })

  it('does not store a value heavier than the whole bound', () => {
    const map = lengthMap(3)
    map.set('a', 'x')
    map.set('big', 'xxxx')

    expect([map.get('big'), map.get('a')]).toEqual([undefined, 'x'])
  })

  it('drops the old value when a replacement is too heavy to store', () => {
    const map = lengthMap(3)
    map.set('a', 'x')
    map.set('a', 'xxxx')

    expect({ value: map.get('a'), size: map.size, weight: map.weight }).toEqual({
      value: undefined,
      size: 0,
      weight: 0
    })
  })

  it('stores a value exactly as heavy as the bound', () => {
    const map = lengthMap(3)
    map.set('a', 'xxx')

    expect(map.get('a')).toBe('xxx')
  })
})
