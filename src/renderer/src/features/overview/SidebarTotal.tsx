import { useTranslation } from 'react-i18next'
import { isPartialFor } from './partialReasons'
import { totalsStatus, type AggregateTotals } from './sumTotals'
import { useTotalsWindowStore } from './state/useTotalsWindowStore'

/** Props for {@link SidebarTotal}. */
interface SidebarTotalProps {
  /** What a sidebar row adds up to. */
  readonly totals: AggregateTotals
}

/**
 * A sidebar row's token total for the chosen window, in short compact
 * notation. It shows nothing while the totals load or when they can't be
 * loaded, and carries a "¹" when the tokens may be low, which a session with no
 * recorded cost doesn't cause. Assistive technology
 * hears the full phrase with the window, such as "12.4M tokens, last 7 days".
 *
 * @example
 * <ProjectRow label="acme-web" meta={<SidebarTotal totals={totals} />} />
 */
export function SidebarTotal({ totals }: SidebarTotalProps): React.JSX.Element | null {
  const { t } = useTranslation('overview')
  const range = useTotalsWindowStore((state) => state.window)
  if (totalsStatus(totals) !== 'ready') return null
  const partial = isPartialFor(totals, 'tokens')

  return (
    <>
      <span aria-hidden="true">
        {t('figure.compact', { value: totals.tokens })}
        {partial && t('partialMarker', { ns: 'common' })}
      </span>
      <span className="visuallyHidden">
        {t('sidebar.tokens', { count: totals.tokens, range: t(`range.${range}`) })}
        {partial && <> {t('sidebar.partial')}</>}
      </span>
    </>
  )
}
