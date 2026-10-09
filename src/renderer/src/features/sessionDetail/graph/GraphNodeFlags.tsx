import { useTranslation } from 'react-i18next'
import type { NodeMarks } from './agentGraphNode'
import styles from './GraphNodeFlags.module.css'
import { markLabels } from './nodeMarks'

/** Props for {@link GraphNodeFlags}. */
interface GraphNodeFlagsProps {
  /** The node's marks, or `null` when they aren't known. */
  readonly marks: NodeMarks | null
  /** Whether the agent was stopped. */
  readonly stopped: boolean
  /** Whether the teammate's own subagents are still loading. */
  readonly loading: boolean
}

/**
 * The flags at the end of a node's second line. While the node loads it holds
 * only the loading flag. Otherwise it holds the tool error and compaction
 * marks, then the stopped flag, and renders nothing when there are none. The
 * node's accessible name says all of them in words.
 *
 * @example
 * <GraphNodeFlags marks={{ toolErrors: 12, compactions: 0 }} stopped={false} loading={false} />
 */
export function GraphNodeFlags({
  marks,
  stopped,
  loading
}: GraphNodeFlagsProps): React.JSX.Element | null {
  const { t } = useTranslation(['sessionDetail', 'sessions'])

  if (loading) return <span className={styles.flag}>{t('graph.node.loadingFlag')}</span>

  const labels = [...markLabels(marks, t), ...(stopped ? [t('graph.node.stoppedFlag')] : [])]
  if (labels.length === 0) return null

  return (
    <span className={styles.flags}>
      {labels.map((label) => (
        <span key={label} className={styles.flag}>
          {label}
        </span>
      ))}
    </span>
  )
}
