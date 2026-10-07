import { useMemo } from 'react'
import { GraphEdges } from './GraphEdges'
import styles from './GraphCanvas.module.css'
import { GraphFootnote } from './GraphFootnote'
import { GraphNode } from './GraphNode'
import { GraphViewport } from './GraphViewport'
import { parentNames } from './parentNames'
import type { AgentGraph } from './useAgentGraph'
import { useGraphAnnouncement } from './useGraphAnnouncement'
import { useGraphKeyboard } from './useGraphKeyboard'

/** Props for {@link GraphCanvas}. */
interface GraphCanvasProps {
  /** The graph to show, from `useAgentGraph`. */
  readonly graph: AgentGraph
}

/**
 * The session's spawn graph: the viewed agent, its subagents and its teammates
 * as buttons on a dot grid, joined by elbow edges, left to right, in a window
 * that pans and zooms. Pressing a node selects it, and the lead is selected
 * until another is. Selecting a teammate opens its own session and adds its
 * subagents under it. The window is a tab stop of its own, so the keyboard can
 * scroll it. After it, only the selected node is in the tab order, and the
 * arrow keys, Home and End move focus among the nodes without selecting them,
 * so a person can look around without changing what is selected. Notes under
 * the graph say so, and explain a partial node and any teammates that weren't
 * found. A press that selects a node, and a teammate's load that settles, are
 * announced in one status region.
 *
 * @example
 * <GraphCanvas graph={graph} />
 */
export function GraphCanvas({ graph }: GraphCanvasProps): React.JSX.Element {
  const { root, layout, loading, expansions, selectedKey } = graph

  const parents = useMemo(() => parentNames(layout), [layout])
  const selectedName = layout.nodes.find(({ node }) => node.key === selectedKey)?.node.name ?? ''
  const announcement = useGraphAnnouncement({
    root,
    expansions,
    selected: { key: selectedKey, name: selectedName }
  })

  const moveFocus = useGraphKeyboard(root)

  return (
    <div className={styles.canvas}>
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
        partialWorkflow={layout.nodes.some(({ node }) => node.kind === 'workflow' && node.partial)}
        missingTeammates={root.missingTeammates}
        teamListsTruncated={root.teamListsTruncated}
      />
      <p role="status" className="visuallyHidden">
        {announcement}
      </p>
    </div>
  )
}
