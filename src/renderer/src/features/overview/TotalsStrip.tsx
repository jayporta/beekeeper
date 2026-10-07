import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { formatUsd } from '@renderer/i18n/formatUsd'
import { FigurePlaceholder } from './FigurePlaceholder'
import { partialFiguresOf } from './partialReasons'
import { totalsStatus, type AggregateTotals } from './sumTotals'
import styles from './TotalsStrip.module.css'
import type { TotalsWindowDto } from '../../../../shared/ipc/projectTotalsDto'

/** Props for {@link TotalsStrip}. */
interface TotalsStripProps {
  /** Every project added together. */
  readonly totals: AggregateTotals
  /** The window the totals cover, to name the strip. */
  readonly range: TotalsWindowDto
}

/**
 * The strip of overall figures: tokens with their cost at API prices beneath,
 * sessions, and agents. A figure that may be low carries a "¹". While no
 * project has totals yet the figures are placeholders. While the figures are
 * the other window's, until this window's arrive, they are muted and the strip
 * is named as updating, with a note beside it.
 *
 * @example
 * <TotalsStrip totals={overall} range="7d" />
 */
export function TotalsStrip({ totals, range }: TotalsStripProps): React.JSX.Element {
  const { t } = useTranslation('overview')
  const status = totalsStatus(totals)
  const partial = partialFiguresOf(totals)
  const { refreshing } = totals
  const partialNote = t('partialNote')
  const rangeName = t(`range.${range}`)

  const figure = (text: string, partial: boolean): React.JSX.Element =>
    status === 'ready' ? (
      <>
        {text}
        {partial && <PartialMarker note={partialNote} />}
      </>
    ) : (
      <FigurePlaceholder loading={status === 'loading'} />
    )

  return (
    <div className={styles.area} data-updating={refreshing}>
      <ul
        className={styles.strip}
        aria-label={
          refreshing
            ? t('totals.labelUpdating', { range: rangeName })
            : t('totals.label', { range: rangeName })
        }
      >
        <li className={styles.cell}>
          <p className={styles.figure}>
            {figure(t('figure.compact', { value: totals.tokens }), partial.tokens)}
          </p>
          <MutedText>{t('totals.tokens')}</MutedText>
          {status === 'ready' && (
            <MutedText>
              {t('apiCost', { value: formatUsd(totals.usd, t) })}
              {partial.cost && <PartialMarker note={partialNote} />}
            </MutedText>
          )}
        </li>
        <li className={styles.cell}>
          <p className={styles.figure}>
            {figure(t('figure.integer', { value: totals.sessions }), partial.sessions)}
          </p>
          <MutedText>{t('totals.sessions')}</MutedText>
        </li>
        <li className={styles.cell}>
          <p className={styles.figure}>
            {figure(t('figure.integer', { value: totals.agents }), partial.agents)}
          </p>
          <MutedText>{t('totals.agents')}</MutedText>
        </li>
      </ul>
      {refreshing && <MutedText>{t('updating')}</MutedText>}
    </div>
  )
}
