import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { EmptyCell } from './EmptyCell'
import styles from './CardCells.module.css'
import { hasUsage } from './hasUsage'
import type { UsageFigures } from './sessionUsage'

/** Props for {@link CardTokens}. */
interface CardTokensProps {
  /** The figures to show, or `null` when the card has none. */
  readonly figures: UsageFigures | null
  /** Whether the figures are the team's total, which labels them so. */
  readonly teamTotal: boolean
  /** Whether the figures leave something out, which adds a marker that points at the footnote. */
  readonly partial: boolean
}

/**
 * The tokens cell of a session card: the token count large, with a muted
 * "team total" or "tokens" beneath it. A missing token figure shows an empty
 * marker that names what is missing, and with no figures at all the cell
 * says that tokens and cost are both not recorded. A partial figure carries a
 * superscript marker, hidden from assistive tech, plus a spoken note that says
 * where the footnote is.
 *
 * @example
 * <CardTokens figures={{ tokens: 12_400_000, usd: 3.2, tokensPartial: false, usdPartial: false }} teamTotal partial={false} />
 */
export function CardTokens({ figures, teamTotal, partial }: CardTokensProps): React.JSX.Element {
  const { t } = useTranslation('sessions')

  if (!hasUsage(figures)) {
    return (
      <div className={styles.cell}>
        <EmptyCell spokenText={t('emptyCell.usageNotRecorded')} />
      </div>
    )
  }

  if (figures.tokens === null) {
    return (
      <div className={styles.cell}>
        <EmptyCell spokenText={t('emptyCell.tokensNotRecorded')} />
        {partial && <PartialMarker note={t('partialNote')} />}
      </div>
    )
  }

  return (
    <div className={styles.cell}>
      <p className={styles.figure}>
        {t('figure.compact', { value: figures.tokens })}
        {partial && <PartialMarker note={t('partialNote')} />}
      </p>
      <MutedText smaller>
        {teamTotal ? (
          <>
            {t('teamTotal')} <span className="visuallyHidden">{t('tokensLabel')}</span>
          </>
        ) : (
          t('tokensLabel')
        )}
      </MutedText>
    </div>
  )
}
