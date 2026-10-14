import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { formatUsd } from '@renderer/i18n/formatUsd'
import { FigurePlaceholder } from './FigurePlaceholder'
import { KpiTile, type KpiKind } from './KpiTile'
import styles from './KpiTiles.module.css'
import { partialFiguresOf } from '../../../../shared/overview/partialReasons'
import { totalsStatus, type AggregateTotals } from '../../../../shared/overview/sumTotals'
import type { TotalsWindowDto } from '../../../../shared/ipc/projectTotalsDto'

/** Props for {@link KpiTiles}. */
interface KpiTilesProps {
  /** Every project added together. */
  readonly totals: AggregateTotals
  /** The window the totals cover, to name the list and the tokens tile. */
  readonly range: TotalsWindowDto
}

/**
 * The overall figures as four tiles: tokens, their cost at API prices,
 * sessions, and agents. A figure that may be low carries a "¹". While no
 * project has totals yet the figures are placeholders. While the figures are
 * the other window's, until this window's arrive, they are muted and the list
 * is named as updating, with a note beside it.
 *
 * @example
 * <KpiTiles totals={overall} range="7d" />
 */
export function KpiTiles({ totals, range }: KpiTilesProps): React.JSX.Element {
  const { t } = useTranslation('overview')
  const status = totalsStatus(totals)
  const partial = partialFiguresOf(totals)
  const { refreshing } = totals
  const partialNote = t('partialNote')
  const rangeName = t(`range.${range}`)

  const figure = (text: string, isPartial: boolean): React.JSX.Element =>
    status === 'ready' ? (
      <>
        {text}
        {isPartial && <PartialMarker note={partialNote} />}
      </>
    ) : (
      <FigurePlaceholder loading={status === 'loading'} />
    )

  const tiles: readonly {
    kind: KpiKind
    value: string
    isPartial: boolean
    sub: string
  }[] = [
    {
      kind: 'tokens',
      value: t('figure.compact', { value: totals.tokens }),
      isPartial: partial.tokens,
      sub: rangeName
    },
    {
      kind: 'api',
      value: formatUsd(totals.usd, t),
      isPartial: partial.cost,
      sub: t('kpi.api.sub')
    },
    {
      kind: 'sessions',
      value: t('figure.integer', { value: totals.sessions }),
      isPartial: partial.sessions,
      sub: t('kpi.sessions.sub')
    },
    {
      kind: 'agents',
      value: t('figure.integer', { value: totals.agents }),
      isPartial: partial.agents,
      sub: t('kpi.agents.sub')
    }
  ]

  return (
    <div className={styles.area} data-updating={refreshing}>
      <ul
        className={styles.tiles}
        aria-label={
          refreshing
            ? t('totals.labelUpdating', { range: rangeName })
            : t('totals.label', { range: rangeName })
        }
      >
        {tiles.map(({ kind, value, isPartial, sub }) => (
          <KpiTile key={kind} kind={kind} label={t(`kpi.${kind}.label`)} sub={sub}>
            {figure(value, isPartial)}
          </KpiTile>
        ))}
      </ul>
      {refreshing && <MutedText>{t('updating')}</MutedText>}
    </div>
  )
}
