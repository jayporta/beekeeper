import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { formatUsd } from '@renderer/i18n/formatUsd'
import { EmptyCell } from './EmptyCell'
import styles from './CardTokens.module.css'
import { formatTokens } from './formatTokens'
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
 * The tokens cell of a session card: the token figure large, then a muted
 * "team total" label for a team's total, then the API-priced cost. A missing
 * token figure or cost shows an empty marker that names what is missing, and
 * with no figures at all the cell shows a single empty marker. Partial
 * figures carry a superscript marker, hidden from assistive tech, plus a
 * spoken note that says where the footnote is.
 *
 * @example
 * <CardTokens figures={{ tokens: 12_400_000, usd: 3.2, tokensPartial: false, usdPartial: false }} teamTotal partial={false} />
 */
export function CardTokens({ figures, teamTotal, partial }: CardTokensProps): React.JSX.Element {
  const { t } = useTranslation('sessions')

  if (figures === null || (figures.tokens === null && figures.usd === null)) {
    return (
      <div className={styles.tokens}>
        <EmptyCell spokenText={t('emptyCell.usageNotRecorded')} />
      </div>
    )
  }

  const tokens = formatTokens(figures.tokens, t)
  const usd = formatUsd(figures.usd, t)

  return (
    <div className={styles.tokens}>
      <p className={styles.figure}>
        {tokens ?? <EmptyCell spokenText={t('emptyCell.tokensNotRecorded')} />}
        {partial && <PartialMarker note={t('partialNote')} />}
      </p>
      {teamTotal && <MutedText smaller>{t('teamTotal')}</MutedText>}
      <MutedText smaller>
        {usd === null ? (
          <EmptyCell spokenText={t('emptyCell.costNotRecorded')} />
        ) : (
          t('apiCost', { value: usd })
        )}
      </MutedText>
    </div>
  )
}
