import { useTranslation } from 'react-i18next'

/** Props for {@link PartialMarker}. */
interface PartialMarkerProps {
  /**
   * The spoken note that sends the reader to the footnote, for a view that
   * isn't a list.
   * @defaultValue The list's note, which points below the list.
   */
  readonly note?: string
}

/**
 * The marker after a partial figure: a superscript that assistive technology
 * skips, and a spoken note that sends the reader to the footnote.
 *
 * @example
 * <p>12.4M tokens<PartialMarker /></p>
 */
export function PartialMarker({ note }: PartialMarkerProps): React.JSX.Element {
  const { t } = useTranslation('sessions')

  return (
    <>
      <sup aria-hidden="true">{t('partialMarker')}</sup>
      <span className="visuallyHidden">{note ?? t('partialNote')}</span>
    </>
  )
}
