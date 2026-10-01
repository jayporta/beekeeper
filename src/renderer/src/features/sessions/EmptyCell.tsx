import { useTranslation } from 'react-i18next'

/** Why a table cell has no value. */
export type EmptyReason = 'not-recorded' | 'not-applicable'

const SPOKEN_KEY = {
  'not-recorded': 'emptyCell.notRecorded',
  'not-applicable': 'emptyCell.notApplicable'
} as const satisfies Record<EmptyReason, string>

/** Props for {@link EmptyCell}. */
interface EmptyCellProps {
  /**
   * Why there is no value: `not-recorded` for data that is missing, and
   * `not-applicable` for a column that does not apply to the row.
   * @defaultValue 'not-recorded'
   */
  readonly reason?: EmptyReason
  /** Replaces the spoken reason, to name what is missing when the cell shows more than one value. */
  readonly spokenText?: string
}

/**
 * The content of a table cell with no value: a dash for sighted readers and
 * the reason for assistive technology.
 *
 * @example
 * <td><EmptyCell reason="not-applicable" /></td>
 */
export function EmptyCell({
  reason = 'not-recorded',
  spokenText
}: EmptyCellProps): React.JSX.Element {
  const { t } = useTranslation('sessions')

  return (
    <>
      <span aria-hidden="true">-</span>
      <span className="visuallyHidden">{spokenText ?? t(SPOKEN_KEY[reason])}</span>
    </>
  )
}
