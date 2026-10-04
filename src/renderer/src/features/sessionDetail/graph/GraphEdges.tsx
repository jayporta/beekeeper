import { memo } from 'react'
import styles from './GraphEdges.module.css'
import type { GraphEdge } from './layoutGraph'

/** Props for {@link GraphEdges}. */
interface GraphEdgesProps {
  /** The elbows to draw, one per node but the root. */
  readonly edges: readonly GraphEdge[]
  /** The graph's width at scale 1, in pixels. */
  readonly width: number
  /** The graph's height at scale 1, in pixels. */
  readonly height: number
}

/**
 * The elbow edges between the graph's nodes, drawn in an SVG the size of the
 * graph. The edges are decoration: the accessible names of the nodes carry the
 * hierarchy. It is memoized, so a render that changes none of its props, such
 * as a selection change, doesn't redraw them.
 *
 * @example
 * <GraphEdges edges={layout.edges} width={layout.width} height={layout.height} />
 */
export const GraphEdges = memo(function GraphEdges({
  edges,
  width,
  height
}: GraphEdgesProps): React.JSX.Element {
  return (
    <svg
      className={styles.edges}
      width={width}
      height={height}
      aria-hidden="true"
      focusable="false"
    >
      {edges.map((edge) => (
        <path key={edge.to} className={styles.edge} d={edge.path} />
      ))}
    </svg>
  )
})
