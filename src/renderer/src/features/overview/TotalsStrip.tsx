import { useTranslation } from 'react-i18next'
import { FigurePlaceholder } from './FigurePlaceholder'
import { formatUsd } from './formatUsd'
import { PartialMark } from './PartialMark'
import { areCountsPartial, isPartial, totalsStatus, type AggregateTotals } from './sumTotals'
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
 * project has totals yet the figures are placeholders.
 *
 * @example
 * <TotalsStrip totals={overall} range="7d" />
 */
export function TotalsStrip({ totals, range }: TotalsStripProps): React.JSX.Element {
  const { t } = useTranslation('overview')
  const status = totalsStatus(totals)
  const countsPartial = areCountsPartial(totals)

  const figure = (text: string, partial: boolean): React.JSX.Element =>
    status === 'ready' ? (
      <>
        {text}
        {partial && <PartialMark />}
      </>
    ) : (
      <FigurePlaceholder loading={status === 'loading'} />
    )

  return (
    <ul className={styles.strip} aria-label={t('totals.label', { range: t(`range.${range}`) })}>
      <li className={styles.cell}>
        <p className={styles.figure}>
          {figure(t('figure.compact', { value: totals.tokens }), isPartial(totals))}
        </p>
        <p className={styles.label}>{t('totals.tokens')}</p>
        {status === 'ready' && (
          <p className={styles.label}>{t('apiCost', { value: formatUsd(totals.usd, t) })}</p>
        )}
      </li>
      <li className={styles.cell}>
        <p className={styles.figure}>
          {figure(t('figure.integer', { value: totals.sessions }), countsPartial)}
        </p>
        <p className={styles.label}>{t('totals.sessions')}</p>
      </li>
      <li className={styles.cell}>
        <p className={styles.figure}>
          {figure(t('figure.integer', { value: totals.agents }), countsPartial)}
        </p>
        <p className={styles.label}>{t('totals.agents')}</p>
      </li>
    </ul>
  )
}
