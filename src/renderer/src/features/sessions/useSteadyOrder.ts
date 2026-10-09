import { useMemo, useState } from 'react'
import type { SessionRow } from './sessionRow'

/** What {@link useSteadyOrder} needs to know about a resort request. */
export interface SteadyOrderOptions {
  /** When a resort was requested, in epoch milliseconds, or 0 for none. */
  readonly resortAt: number
  /** When the rows' data last loaded, in epoch milliseconds. */
  readonly dataUpdatedAt: number
}

const sameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, index) => key === b[index])

/**
 * Keeps session cards where they are while the list refetches in the
 * background. A refetch re-sorts the rows by last activity, which would move
 * a running session's card to the top, shift every other card, and move the
 * reader's focus and place. Rows still present keep their earlier relative
 * order, new rows go first in their sorted order, and rows that are gone drop
 * out. The first call shows the rows as sorted.
 *
 * A resort request takes effect on the first rows whose data loaded at or
 * after `resortAt`: those are shown as sorted, and the order holds from there.
 * Each request applies once.
 *
 * @param rows - The top-level rows, sorted newest first.
 * @param options - The pending resort request and when the data last loaded.
 * @returns The rows in the steady order. The same array while that order and the rows are unchanged.
 */
export function useSteadyOrder(
  rows: readonly SessionRow[],
  { resortAt, dataUpdatedAt }: SteadyOrderOptions
): readonly SessionRow[] {
  const [order, setOrder] = useState<readonly string[]>([])
  const [resortApplied, setResortApplied] = useState(0)

  const resort = resortAt > resortApplied && dataUpdatedAt >= resortAt
  const keys = useMemo(() => {
    const known = new Set(order)
    const present = new Set(rows.map((row) => row.key))
    const added = rows.filter((row) => !known.has(row.key)).map((row) => row.key)
    return [...added, ...order.filter((key) => present.has(key))]
  }, [rows, order])
  const nextOrder = resort ? rows.map((row) => row.key) : keys

  // Adjusting state while rendering: React re-renders at once with the new order.
  if (resort) setResortApplied(resortAt)
  if (!sameKeys(nextOrder, order)) setOrder(nextOrder)

  return useMemo(() => {
    const byKey = new Map(rows.map((row) => [row.key, row]))
    return nextOrder.flatMap((key) => byKey.get(key) ?? [])
  }, [rows, nextOrder])
}
