import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { EmptyCell } from '@renderer/features/sessions/EmptyCell'
import type { AgentGraphNode } from './agentGraphNode'
import { GRAPH_FOOTNOTE_ID, GRAPH_WORKFLOW_FOOTNOTE_ID } from './graphFootnoteId'
import { NODE_HEIGHT, NODE_WIDTH } from './graphMetrics'
import styles from './GraphNode.module.css'
import { nodeAccessibleName, nodeDetail } from './nodeFacts'

/** Props for {@link GraphNode}. */
interface GraphNodeProps {
  /** The agent or workflow run to show. */
  readonly node: AgentGraphNode
  /** The left edge on the canvas, in pixels. */
  readonly x: number
  /** The top edge on the canvas, in pixels. */
  readonly y: number
  /** Whether this is the selected agent. */
  readonly selected: boolean
  /** Whether the teammate's own subagents are still loading. */
  readonly loading: boolean
  /** The name of the agent that spawned this one, or `null` for the root. Transcript-derived. */
  readonly parentName: string | null
  /** Moves focus along the graph on an arrow, Home or End key. It reads the node from the button's `data-agent-key`. */
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
}

/**
 * One node on the graph, as a button that selects it. The first line is its
 * name and own tokens, and the second its type and model (or the folder of a
 * teammate in another folder, or a workflow run's kind and phase count) and a
 * stopped flag. A lead is filled, a teammate has a solid border, a subagent a
 * dashed one, and a workflow run a double one, and the selected node has a
 * heavier border and a ring around it. The accessible name carries all of that
 * and the parent's name, and `aria-current` marks the selected node: pressing
 * the selected node doesn't unselect it, so it is a choice among nodes, not a
 * toggle. It is memoized, so a selection
 * change re-renders only the two nodes it affects. Only the selected node is
 * in the tab order: the arrow keys move among the others.
 *
 * @example
 * <GraphNode node={node} x={28} y={28} selected={false} loading={false} parentName="Lead" onKeyDown={move} />
 */
export const GraphNode = memo(function GraphNode({
  node,
  x,
  y,
  selected,
  loading,
  parentName,
  onKeyDown
}: GraphNodeProps): React.JSX.Element {
  const { t } = useTranslation(['sessionDetail', 'sessions'])
  const selectAgent = useNavigationStore((state) => state.selectAgent)
  const detail = nodeDetail(node, t).join(t('graph.node.lineSeparator'))
  const footnoteId = node.kind === 'workflow' ? GRAPH_WORKFLOW_FOOTNOTE_ID : GRAPH_FOOTNOTE_ID
  const className = [styles.node, styles[node.kind], selected ? styles.selected : null]
    .filter((name) => name !== null)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      style={{ left: x, top: y, width: NODE_WIDTH, height: NODE_HEIGHT }}
      data-agent-key={node.key}
      tabIndex={selected ? 0 : -1}
      aria-label={nodeAccessibleName(node, { t, loading, parent: parentName })}
      aria-current={selected ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      aria-describedby={node.partial ? footnoteId : undefined}
      onClick={() => {
        selectAgent(node.selection)
      }}
      onKeyDown={onKeyDown}
    >
      <span className={styles.line}>
        <span className={styles.name}>
          <bdi>{node.name}</bdi>
        </span>
        <span className={styles.tokens}>
          {node.tokens === null ? (
            <EmptyCell spokenText={t('graph.node.tokensUnknown')} />
          ) : (
            t('graph.node.tokensShort', { count: node.tokens })
          )}
          {node.partial && <sup aria-hidden="true">{t('graph.node.partialMarker')}</sup>}
        </span>
      </span>
      <span className={styles.line}>
        <MutedText as="span" smaller className={styles.detail}>
          {detail !== '' && <bdi>{detail}</bdi>}
        </MutedText>
        {loading ? (
          <span className={styles.flag}>{t('graph.node.loadingFlag')}</span>
        ) : (
          node.stopped && <span className={styles.flag}>{t('graph.node.stoppedFlag')}</span>
        )}
      </span>
    </button>
  )
})
