import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import { focusGraphNode } from './focusGraphNode'
import { GraphEdges } from './GraphEdges'
import styles from './GraphCanvas.module.css'
import { GraphFootnote } from './GraphFootnote'
import { GRAPH_HINT_ID } from './graphFootnoteId'
import { directionOfKey, graphNeighbor } from './graphNavigation'
import { GraphNode } from './GraphNode'
import { GraphViewport } from './GraphViewport'
import { parentNames } from './parentNames'
import { selectedAgentKey } from './selectedAgentKey'
import { useAgentGraph } from './useAgentGraph'

/** Props for {@link GraphCanvas}. */
interface GraphCanvasProps {
  /** The viewed session's agent tree and reports. */
  readonly detail: SessionDetailDto
  /** The viewed session. */
  readonly sessionRef: SessionRefDto
  /** The session's row in its folder's sessions list, or `null` when the list doesn't hold it. */
  readonly row: SessionRow | null
}

/**
 * The session's spawn graph: the viewed agent, its subagents and its teammates
 * as buttons on a dot grid, joined by elbow edges, left to right, in a window
 * that pans and zooms. Pressing a node selects it, and the lead is selected
 * until another is. Selecting a teammate opens its own session and adds its
 * subagents under it. Only the selected node is in the tab order, and the
 * arrow keys, Home and End move focus among the nodes without selecting them,
 * so a person can look around without changing what is selected. Notes under
 * the graph say so, and explain a partial node and any teammates that weren't
 * found. A teammate's load that settles is announced in a status region.
 *
 * @example
 * <GraphCanvas detail={detail} sessionRef={ref} row={row} />
 */
export function GraphCanvas({ detail, sessionRef, row }: GraphCanvasProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { root, layout, loading, announcement } = useAgentGraph({ detail, sessionRef, row })
  const selectedAgent = useNavigationStore((state) => state.selectedAgent)
  const selectedKey = useMemo(
    () =>
      selectedAgentKey(
        layout.nodes.map(({ node }) => node),
        selectedAgent
      ),
    [layout, selectedAgent]
  )

  const parents = useMemo(() => parentNames(layout), [layout])

  const moveFocus = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const direction = directionOfKey(event.key)
      const from = event.currentTarget.dataset.agentKey
      // Alt with an arrow is the browser's history shortcut, and Ctrl or Cmd belongs to the system.
      if (
        direction === null ||
        from === undefined ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return
      // An arrow key never scrolls the window while a node is focused, even at the end of a branch.
      event.preventDefault()
      const target = graphNeighbor(root, from, direction)
      if (target !== null) focusGraphNode(event.currentTarget, target)
    },
    [root]
  )

  return (
    <section
      aria-label={t('graph.label')}
      aria-describedby={GRAPH_HINT_ID}
      className={styles.canvas}
    >
      <GraphViewport width={layout.width} height={layout.height}>
        <GraphEdges edges={layout.edges} width={layout.width} height={layout.height} />
        {layout.nodes.map(({ node, x, y }) => (
          <GraphNode
            key={node.key}
            node={node}
            x={x}
            y={y}
            selected={node.key === selectedKey}
            loading={loading.has(node.key)}
            parentName={parents.get(node.key) ?? null}
            onKeyDown={moveFocus}
          />
        ))}
      </GraphViewport>
      <GraphFootnote
        partial={layout.nodes.some(({ node }) => node.partial)}
        missingTeammates={root.missingTeammates}
        teamListsTruncated={root.teamListsTruncated}
      />
      <p role="status" className="visuallyHidden">
        {announcement}
      </p>
    </section>
  )
}
