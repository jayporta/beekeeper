import type { SessionRow } from './sessionRow'

/** A row to render, and whether it is nested under a lead. */
export interface VisibleRow {
  /** The row. */
  readonly row: SessionRow
  /** Whether it renders as a teammate under a lead. */
  readonly nested: boolean
  /** The lead's name for a nested row, for assistive technology. `null` for a top-level row. */
  readonly leadLabel: string | null
}

/** What {@link visibleRows} lays out. */
export interface VisibleRowsOptions {
  /** The top-level rows, already filtered. */
  readonly rows: readonly SessionRow[]
  /** The keys of expanded leads. */
  readonly expanded: ReadonlySet<string>
  /** Whether a search is active. */
  readonly searching: boolean
}

/**
 * Flattens top-level rows into the rows on screen: each row, followed by its
 * teammates when it is expanded or when a search is active, since a search
 * shows matching teammates whether or not their lead is expanded.
 *
 * @param options - The rows, which leads are expanded, and whether a search is active.
 * @returns The rows in display order.
 */
export function visibleRows({
  rows,
  expanded,
  searching
}: VisibleRowsOptions): readonly VisibleRow[] {
  return rows.flatMap((row) => {
    const shown = searching || expanded.has(row.key)
    const leadLabel = shown ? row.label.text : null
    return [
      { row, nested: false, leadLabel: null },
      ...(shown
        ? row.teammates.map((teammate) => ({ row: teammate, nested: true, leadLabel }))
        : [])
    ]
  })
}
