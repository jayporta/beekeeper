/** Why a table cell has no value. */
export type EmptyReason = 'not-recorded' | 'not-applicable'

const SPOKEN: Record<EmptyReason, string> = {
  'not-recorded': 'not recorded',
  'not-applicable': 'not applicable'
}

/** Props for {@link EmptyCell}. */
interface EmptyCellProps {
  /**
   * Why there is no value: `not-recorded` for data that is missing, and
   * `not-applicable` for a column that does not apply to the row.
   * @defaultValue 'not-recorded'
   */
  readonly reason?: EmptyReason
}

/**
 * The content of a table cell with no value: a dash for sighted readers and
 * the reason for assistive technology.
 *
 * @example
 * <td><EmptyCell reason="not-applicable" /></td>
 */
export function EmptyCell({ reason = 'not-recorded' }: EmptyCellProps): React.JSX.Element {
  return (
    <>
      <span aria-hidden="true">-</span>
      <span className="visuallyHidden">{SPOKEN[reason]}</span>
    </>
  )
}
