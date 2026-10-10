import { useMemo, useState } from 'react'
import type { SessionRow } from './sessionRow'

/** What {@link useSteadyOrder} needs to know about a resort request. */
export interface SteadyOrderOptions {
  /** When a resort was requested, in epoch milliseconds, or 0 for none. */
  readonly resortAt: number
  /** When the rows' data last loaded, in epoch milliseconds. */
  readonly dataUpdatedAt: number
  /** When a load of the rows' data last failed, in epoch milliseconds, or 0 if none has. */
  readonly errorUpdatedAt: number
}

/** The rows in their steady order, and the resort request they last settled. */
export interface SteadyOrder {
  /** The rows in the steady order. The same array while that order and the rows are unchanged. */
  readonly rows: readonly SessionRow[]
  /** The last resort request that took effect or was dropped, or 0 for none. */
  readonly settledResortAt: number
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
 * A load that fails after the request, before any newer data, drops it, so a
 * later background update doesn't re-sort under the reader. Each request
 * applies once, and any other nonzero `resortAt`, earlier or later, is a new
 * request, since a folder switch can request an earlier time than the last.
 *
 * @param rows - The top-level rows, sorted newest first.
 * @param options - The pending resort request and when the data last loaded.
 * @returns The rows in the steady order, and the request they last settled.
 */
export function useSteadyOrder(
  rows: readonly SessionRow[],
  { resortAt, dataUpdatedAt, errorUpdatedAt }: SteadyOrderOptions
): SteadyOrder {
  const [order, setOrder] = useState<readonly string[]>([])
  const [resortApplied, setResortApplied] = useState(0)

  const pending = resortAt !== 0 && resortAt !== resortApplied
  const resort = pending && dataUpdatedAt >= resortAt
  const dropped = pending && !resort && errorUpdatedAt >= resortAt
  const keys = useMemo(() => {
    const known = new Set(order)
    const present = new Set(rows.map((row) => row.key))
    const added = rows.filter((row) => !known.has(row.key)).map((row) => row.key)
    return [...added, ...order.filter((key) => present.has(key))]
  }, [rows, order])
  const nextOrder = resort ? rows.map((row) => row.key) : keys

  // Adjusting state while rendering: React re-renders at once with the new order.
  if (resort || dropped) setResortApplied(resortAt)
  if (!sameKeys(nextOrder, order)) setOrder(nextOrder)

  const ordered = useMemo(() => {
    const byKey = new Map(rows.map((row) => [row.key, row]))
    return nextOrder.flatMap((key) => byKey.get(key) ?? [])
  }, [rows, nextOrder])
  return { rows: ordered, settledResortAt: resort || dropped ? resortAt : resortApplied }
}
