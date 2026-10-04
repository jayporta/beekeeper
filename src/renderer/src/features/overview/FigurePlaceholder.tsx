import { useTranslation } from 'react-i18next'

/** Props for {@link FigurePlaceholder}. */
interface FigurePlaceholderProps {
  /** Whether the figure is still on its way. When it is not, it couldn't be loaded. */
  readonly loading: boolean
}

/**
 * Stands in for a figure that isn't there: a quiet mark for sighted readers and
 * a spoken word for assistive technology.
 *
 * @example
 * <p><FigurePlaceholder loading /></p>
 */
export function FigurePlaceholder({ loading }: FigurePlaceholderProps): React.JSX.Element {
  const { t } = useTranslation('overview')
  const reason = loading ? 'loading' : 'unavailable'

  return (
    <>
      <span aria-hidden="true">{t(`placeholder.${reason}Mark`)}</span>
      <span className="visuallyHidden">{t(`placeholder.${reason}`)}</span>
    </>
  )
}
