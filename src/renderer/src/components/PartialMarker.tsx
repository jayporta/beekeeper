import { useTranslation } from 'react-i18next'

/** Props for {@link PartialMarker}. */
interface PartialMarkerProps {
  /** The spoken note that sends the reader to the footnote. */
  readonly note: string
}

/**
 * The marker after a partial figure: a superscript that assistive technology
 * skips, and a spoken note that sends the reader to the footnote. A space
 * keeps the note from reading run together with the figure.
 *
 * @example
 * <p>12.4M tokens<PartialMarker note={t('partialNote')} /></p>
 */
export function PartialMarker({ note }: PartialMarkerProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <>
      <sup aria-hidden="true">{t('partialMarker')}</sup>{' '}
      <span className="visuallyHidden">{note}</span>
    </>
  )
}
