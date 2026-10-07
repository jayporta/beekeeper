import { useTranslation } from 'react-i18next'
import { EmptyCell } from '@renderer/features/sessions/EmptyCell'
import { formatTokens } from '@renderer/features/sessions/formatTokens'
import { InspectorMarker } from './InspectorMarker'
import styles from './InspectorTotalsFrame.module.css'

/** Props for {@link InspectorTotalsFrame}. */
interface InspectorTotalsFrameProps {
  /** The tokens to show in large type, or `null` when none are recorded. */
  readonly tokens: number | null
  /** Whether the tokens may be low, which adds a "¹" after the figure. */
  readonly partial: boolean
  /** The notes under the figure. */
  readonly children: React.ReactNode
}

/**
 * The block that holds an agent's or a run's totals: the token figure in
 * large type, which says so when no tokens are recorded and carries a "¹"
 * when it may be low, then the notes under it.
 *
 * @example
 * <InspectorTotalsFrame tokens={1200} partial={false}>
 *   <MutedText>No agents below</MutedText>
 * </InspectorTotalsFrame>
 */
export function InspectorTotalsFrame({
  tokens,
  partial,
  children
}: InspectorTotalsFrameProps): React.JSX.Element {
  const { t: tSessions } = useTranslation('sessions')
  const noTokensText = tSessions('emptyCell.tokensNotRecorded')

  return (
    <div className={styles.totals}>
      <p className={styles.figure}>
        {formatTokens(tokens, tSessions) ?? <EmptyCell spokenText={noTokensText} />}
        {partial && <InspectorMarker />}
      </p>
      {children}
    </div>
  )
}
