import { useTranslation } from 'react-i18next'

/**
 * The marker after a partial figure: a superscript that assistive technology
 * skips, and a spoken note that sends the reader to the footnote.
 *
 * @example
 * <p>12.4M tokens<PartialMarker /></p>
 */
export function PartialMarker(): React.JSX.Element {
  const { t } = useTranslation('sessions')

  return (
    <>
      <sup aria-hidden="true">{t('partialMarker')}</sup>
      <span className="visuallyHidden">{t('partialNote')}</span>
    </>
  )
}
