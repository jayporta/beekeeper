import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import styles from './GraphFootnote.module.css'
import { GRAPH_FOOTNOTE_ID, GRAPH_NOTES_ID, GRAPH_WORKFLOW_FOOTNOTE_ID } from './graphFootnoteId'

/** Props for {@link GraphFootnote}. */
interface GraphFootnoteProps {
  /** Whether any node is partial, which the "¹" on it points here to explain. */
  readonly partial: boolean
  /** Whether any workflow run is partial, which its "¹" means differently: some of its agents are. */
  readonly partialWorkflow: boolean
  /** Whether any node has a tool error or compaction mark, which the legend explains. */
  readonly marks: boolean
  /** How many teammates the lead spawned that never appeared as sessions. */
  readonly missingTeammates: number
  /** Whether the lead's spawn or stop lists hit their cap, so more teammates may be missing. */
  readonly teamListsTruncated: boolean
}

/**
 * The quiet notes under the graph: how to move among the nodes with the
 * keyboard, then why a "¹" marks a node (and what it means on a workflow run), what the
 * node marks mean (hidden from assistive technology, since a node's name says them in words), how many teammates the lead spawned
 * that aren't in the sessions list, and that the lead's lists hit their cap.
 * Only the selected node is in the tab order, so the keyboard hint is always
 * there. They describe the graph region, so a screen reader reads them on
 * entering it.
 *
 * @example
 * <GraphFootnote partial={false} partialWorkflow={false} marks={false} missingTeammates={2} teamListsTruncated={false} />
 */
export function GraphFootnote({
  partial,
  partialWorkflow,
  marks,
  missingTeammates,
  teamListsTruncated
}: GraphFootnoteProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')

  return (
    <MutedText as="div" smaller id={GRAPH_NOTES_ID} className={styles.footnotes}>
      <p>{t('graph.footnote.keyboard')}</p>
      {partial && <p id={GRAPH_FOOTNOTE_ID}>{t('graph.footnote.partial')}</p>}
      {partialWorkflow && (
        <p id={GRAPH_WORKFLOW_FOOTNOTE_ID}>{t('graph.footnote.partialWorkflow')}</p>
      )}
      {marks && (
        <p aria-hidden="true" className={styles.legend}>
          <span>{t('graph.footnote.legend.toolErrors')}</span>
          <span>{t('graph.footnote.legend.compactions')}</span>
          <span>{t('graph.footnote.legend.stopped')}</span>
        </p>
      )}
      {missingTeammates > 0 && (
        <p>{t('graph.footnote.missingTeammates', { count: missingTeammates })}</p>
      )}
      {teamListsTruncated && <p>{t('graph.footnote.truncated')}</p>}
    </MutedText>
  )
}
