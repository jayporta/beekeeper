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
 * loaded. When the tokens may be low, which a session with no recorded cost
 * doesn't cause, it leads with a "~" and is named as possibly low: the sidebar
 * shows on every view, and the "¹" footnote only on the overview. Assistive
 * technology hears the full phrase with the window, such as "12.4M tokens, last 7 days".
 * While the other window's figure stands in, it carries a "…" and is named as
 * updating rather than with the chosen window.
 *
 * @example
 * <ProjectRow label="acme-web" meta={<SidebarTotal totals={totals} />} />
 */
export function SidebarTotal({ totals }: SidebarTotalProps): React.JSX.Element | null {
  const { t } = useTranslation('overview')
  const range = useTotalsWindowStore((state) => state.window)
  if (totalsStatus(totals) !== 'ready') return null
  const partial = isPartialFor(totals, 'tokens')
  const figure = totals.refreshing
    ? t('sidebar.tokensUpdating', { count: totals.tokens })
    : t('sidebar.tokens', { count: totals.tokens, range: t(`range.${range}`) })

  return (
    <>
      <span aria-hidden="true">
        {partial && t('sidebar.mayBeLowMarker')}
        {t('figure.compact', { value: totals.tokens })}
        {totals.refreshing && t('sidebar.updatingMarker')}
      </span>
      <span className="visuallyHidden">{partial ? t('sidebar.mayBeLow', { figure }) : figure}</span>
    </>
  )
}
