import { renderHook, type RenderHookResult } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SessionRow } from '../sessionRow'
import { testSession } from '../testSessionFixtures'
import { testRow } from '../testSessionRows'
import { useSteadyOrder, type SteadyOrderOptions } from '../useSteadyOrder'

const NOW = 1_000_000
const NO_RESORT: SteadyOrderOptions = { resortAt: 0, dataUpdatedAt: NOW, errorUpdatedAt: 0 }

/**
 * The top-level rows for sessions numbered by key, session `n` last active at
 * `latest[n]`, in the order the list sorts them: newest first.
 */
function rowsOf(latest: Record<number, number>, title: string | null = null): SessionRow[] {
  const items = Object.entries(latest).map(([n, latestMs]) =>
    testSession(Number(n), { latestMs, title })
  )
  return Object.keys(latest)
    .map(Number)
    .sort((a, b) => (latest[b] ?? 0) - (latest[a] ?? 0))
    .map((n) => testRow(n, items))
}

const numbersOf = (rows: readonly SessionRow[]): number[] =>
  rows.map((row) => Number(row.item.sessionId.slice(0, 8)))

interface Props {
  readonly rows: readonly SessionRow[]
  readonly options: SteadyOrderOptions
}

function setup(rows: readonly SessionRow[]): RenderHookResult<readonly SessionRow[], Props> {
  return renderHook((props: Props) => useSteadyOrder(props.rows, props.options).rows, {
    initialProps: { rows, options: NO_RESORT }
  })
}

describe('useSteadyOrder', () => {
  it('returns the rows as sorted on the first render', () => {
    const { result } = setup(rowsOf({ 1: 300, 2: 200, 3: 100 }))

    expect(numbersOf(result.current)).toEqual([1, 2, 3])
  })

  it('keeps the visible order when a refetch makes a lower row the newest', () => {
    const { result, rerender } = setup(rowsOf({ 1: 300, 2: 200 }))

    rerender({ rows: rowsOf({ 1: 300, 2: 400 }), options: NO_RESORT })

    expect(numbersOf(result.current)).toEqual([1, 2])
  })

  it('shows the refetched data in a row that kept its place', () => {
    const { result, rerender } = setup(rowsOf({ 1: 300, 2: 200 }, 'old'))

    rerender({ rows: rowsOf({ 1: 300, 2: 400 }, 'new'), options: NO_RESORT })

    expect(result.current.map((row) => row.label)).toEqual(
      rowsOf({ 1: 300, 2: 400 }, 'new')
        .reverse()
        .map((row) => row.label)
    )
  })

  it('puts a new row first, and several new rows first in their sorted order', () => {
    const { result, rerender } = setup(rowsOf({ 1: 300, 2: 200 }))

    rerender({ rows: rowsOf({ 1: 300, 2: 200, 3: 500, 4: 600 }), options: NO_RESORT })

    expect(numbersOf(result.current)).toEqual([4, 3, 1, 2])
  })

  it('drops a row that is gone, and puts it first if it comes back', () => {
    const { result, rerender } = setup(rowsOf({ 1: 300, 2: 200, 3: 100 }))

    rerender({ rows: rowsOf({ 1: 300, 3: 100 }), options: NO_RESORT })
    expect(numbersOf(result.current)).toEqual([1, 3])

    rerender({ rows: rowsOf({ 1: 300, 2: 200, 3: 100 }), options: NO_RESORT })
    expect(numbersOf(result.current)).toEqual([2, 1, 3])
  })

  it('returns the same array while the rows keep their order', () => {
    const rows = rowsOf({ 1: 300, 2: 200 })
    const { result, rerender } = setup(rows)
    const first = result.current

    rerender({ rows, options: NO_RESORT })

    expect(result.current).toBe(first)
  })

  describe('a resort request', () => {
    const request: SteadyOrderOptions = {
      resortAt: NOW + 10,
      dataUpdatedAt: NOW + 10,
      errorUpdatedAt: 0
    }

    it('re-sorts once data newer than the request arrives', () => {
      const { result, rerender } = setup(rowsOf({ 1: 300, 2: 200 }))

      rerender({ rows: rowsOf({ 1: 300, 2: 400 }), options: request })

      expect(numbersOf(result.current)).toEqual([2, 1])
    })

    it('waits for data newer than the request', () => {
      const { result, rerender } = setup(rowsOf({ 1: 300, 2: 200 }))
      const reordered = rowsOf({ 1: 300, 2: 400 })

      rerender({ rows: reordered, options: { ...request, dataUpdatedAt: NOW + 9 } })
      expect(numbersOf(result.current)).toEqual([1, 2])

      rerender({ rows: reordered, options: request })
      expect(numbersOf(result.current)).toEqual([2, 1])
    })

    it('is dropped when a load fails after it, so later data keeps the order', () => {
      const { result, rerender } = setup(rowsOf({ 1: 300, 2: 200 }))
      const failed = { resortAt: NOW + 10, dataUpdatedAt: NOW, errorUpdatedAt: NOW + 11 }
      rerender({ rows: rowsOf({ 1: 300, 2: 200 }), options: failed })

      rerender({
        rows: rowsOf({ 1: 300, 2: 400 }),
        options: { ...failed, dataUpdatedAt: NOW + 20 }
      })

      expect(numbersOf(result.current)).toEqual([1, 2])
    })

    it('is kept when the failure came before it', () => {
      const { result, rerender } = setup(rowsOf({ 1: 300, 2: 200 }))
      const earlier = { resortAt: NOW + 10, dataUpdatedAt: NOW, errorUpdatedAt: NOW + 5 }
      rerender({ rows: rowsOf({ 1: 300, 2: 200 }), options: earlier })

      rerender({
        rows: rowsOf({ 1: 300, 2: 400 }),
        options: { ...earlier, dataUpdatedAt: NOW + 20 }
      })

      expect(numbersOf(result.current)).toEqual([2, 1])
    })

    it('keeps the new order steady afterwards', () => {
      const { result, rerender } = setup(rowsOf({ 1: 300, 2: 200 }))
      rerender({ rows: rowsOf({ 1: 300, 2: 400 }), options: request })

      rerender({
        rows: rowsOf({ 1: 500, 2: 400 }),
        options: { ...request, dataUpdatedAt: NOW + 20 }
      })

      expect(numbersOf(result.current)).toEqual([2, 1])
    })
  })
})
