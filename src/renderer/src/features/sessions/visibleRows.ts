import type { SessionRow } from './sessionRow'

/** A row to render, and whether it is nested under a lead. */
export interface VisibleRow {
  /** The row. */
  readonly row: SessionRow
  /** Whether it renders as a teammate under a lead. */
  readonly nested: boolean
}

/**
 * Flattens top-level rows into the rows on screen: each row, followed by its
 * teammates when it is expanded or when a search is active, since a search
 * shows matching teammates whether or not their lead is expanded.
 *
 * @param rows - The top-level rows, already filtered.
 * @param expanded - The keys of expanded leads.
 * @param searching - Whether a search is active.
 * @returns The rows in display order.
 */
export function visibleRows(
  rows: readonly SessionRow[],
  expanded: ReadonlySet<string>,
  searching: boolean
): readonly VisibleRow[] {
  return rows.flatMap((row) => [
    { row, nested: false },
    ...(searching || expanded.has(row.key)
      ? row.teammates.map((teammate) => ({ row: teammate, nested: true }))
      : [])
  ])
}
