import { useTranslation } from 'react-i18next'
import styles from './GraphFootnote.module.css'
import { GRAPH_FOOTNOTE_ID } from './graphFootnoteId'

/** Props for {@link GraphFootnote}. */
interface GraphFootnoteProps {
  /** Whether any node is partial, which the "¹" on it points here to explain. */
  readonly partial: boolean
  /** How many teammates the lead spawned that never appeared as sessions. */
  readonly missingTeammates: number
  /** Whether the lead's spawn or stop lists hit their cap, so more teammates may be missing. */
  readonly teamListsTruncated: boolean
}

/**
 * The quiet notes under the graph: why a "¹" marks a node, how many teammates
 * the lead spawned that aren't in the sessions list, and that the lead's lists
 * hit their cap. It renders nothing when there is nothing to say.
 *
 * @example
 * <GraphFootnote partial={false} missingTeammates={2} teamListsTruncated={false} />
 */
export function GraphFootnote({
  partial,
  missingTeammates,
  teamListsTruncated
}: GraphFootnoteProps): React.JSX.Element | null {
  const { t } = useTranslation('sessionDetail')
  if (!partial && missingTeammates === 0 && !teamListsTruncated) return null

  return (
    <div className={styles.footnotes}>
      {partial && <p id={GRAPH_FOOTNOTE_ID}>{t('graph.footnote.partial')}</p>}
      {missingTeammates > 0 && (
        <p>{t('graph.footnote.missingTeammates', { count: missingTeammates })}</p>
      )}
      {teamListsTruncated && <p>{t('graph.footnote.truncated')}</p>}
    </div>
  )
}
