import { useTranslation } from 'react-i18next'

/** Props for {@link EmptyCell}. */
interface EmptyCellProps {
  /** Replaces the spoken "not recorded", to name what is missing when a cell shows more than one value. */
  readonly spokenText?: string
}

/**
 * The content of a card cell with no value: a dash for sighted readers and
 * "not recorded" for assistive technology.
 *
 * @example
 * <p><EmptyCell /></p>
 */
export function EmptyCell({ spokenText }: EmptyCellProps): React.JSX.Element {
  const { t } = useTranslation('sessions')

  return (
    <>
      <span aria-hidden="true">-</span>
      <span className="visuallyHidden">{spokenText ?? t('emptyCell.notRecorded')}</span>
    </>
  )
}
