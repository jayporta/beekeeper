import { replaceEqualDeep } from '@tanstack/react-query'
import { useState } from 'react'
import type { SessionRow } from './sessionRow'

function sameRows(a: readonly SessionRow[], b: readonly SessionRow[]): boolean {
  return a.length === b.length && a.every((row, index) => row === b[index])
}

function reuseRow(row: SessionRow, earlier: SessionRow | undefined): SessionRow {
  if (earlier === undefined) return row
  const teammates = reuseRows(row.teammates, earlier.teammates)
  const unchanged =
    // A refetch shares unchanged items by index, so an item after an added or removed one is
    // a new object with the same content.
    replaceEqualDeep(earlier.item, row.item) === earlier.item &&
    row.leadFolder === earlier.leadFolder &&
    row.label.text === earlier.label.text &&
    row.label.idHint === earlier.label.idHint &&
    sameRows(teammates, earlier.teammates)
  if (unchanged) return earlier
  return sameRows(teammates, row.teammates) ? row : { ...row, teammates }
}

function reuseRows(rows: readonly SessionRow[], earlier: readonly SessionRow[]): SessionRow[] {
  const earlierByKey = new Map(earlier.map((row) => [row.key, row]))
  return rows.map((row) => reuseRow(row, earlierByKey.get(row.key)))
}

/**
 * Keeps each session row the same object while what it shows is unchanged,
 * so a memoized card skips rendering when a background update changes other
 * sessions. A row is unchanged when its list item is deeply equal to the
 * earlier one, and its label, lead folder and teammate rows are unchanged.
 *
 * @param rows - The grouped rows, which are new objects on every grouping.
 * @returns The rows, reusing the earlier object for each unchanged row.
 */
export function useReusedRows(rows: readonly SessionRow[]): readonly SessionRow[] {
  const [held, setHeld] = useState({ input: rows, output: rows })
  if (held.input === rows) return held.output
  const output = reuseRows(rows, held.output)
  // Adjusting state while rendering: React re-renders at once with the held rows.
  setHeld({ input: rows, output })
  return output
}
