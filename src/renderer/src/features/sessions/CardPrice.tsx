import { useTranslation } from 'react-i18next'
import { formatUsd } from '@renderer/i18n/formatUsd'
import { EmptyCell } from './EmptyCell'
import styles from './CardCells.module.css'
import { hasUsage } from './hasUsage'
import type { UsageFigures } from './sessionUsage'

/** Props for {@link CardPrice}. */
interface CardPriceProps {
  /** The figures to show, or `null` when the card has none. */
  readonly figures: UsageFigures | null
}

/**
 * The API price cell of a session card: the recorded cost at API prices. A
 * missing cost shows an empty marker that says so. With no figures at all the
 * tokens cell already says that tokens and cost are not recorded, so this cell
 * shows only a dash that assistive technology skips.
 *
 * @example
 * <CardPrice figures={{ tokens: 12_400_000, usd: 3.2, tokensPartial: false, usdPartial: false }} />
 */
export function CardPrice({ figures }: CardPriceProps): React.JSX.Element {
  const { t } = useTranslation('sessions')

  if (!hasUsage(figures)) {
    return (
      <div className={styles.cell}>
        <span aria-hidden="true">-</span>
      </div>
    )
  }

  const usd = formatUsd(figures.usd, t)

  return (
    <div className={styles.cell}>
      <span className="visuallyHidden">{t('columns.price')} </span>
      {usd ?? <EmptyCell spokenText={t('emptyCell.costNotRecorded')} />}
    </div>
  )
}
