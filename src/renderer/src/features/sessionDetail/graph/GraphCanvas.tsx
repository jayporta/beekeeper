import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import styles from './GraphCanvas.module.css'
import { GraphFootnote } from './GraphFootnote'
import { GraphNode } from './GraphNode'
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
 * as buttons on a dot grid, joined by elbow edges, left to right. Pressing a
 * node selects it, and the lead is selected until another is. Notes under the
 * graph explain a partial node and any teammates that weren't found.
 *
 * @example
 * <GraphCanvas detail={detail} sessionRef={ref} row={row} />
 */
export function GraphCanvas({ detail, sessionRef, row }: GraphCanvasProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { root, layout } = useAgentGraph({ detail, sessionRef, row })
  const selectedAgent = useNavigationStore((state) => state.selectedAgent)
  const selectedKey = useMemo(
    () =>
      selectedAgentKey(
        layout.nodes.map(({ node }) => node),
        selectedAgent
      ),
    [layout, selectedAgent]
  )

  return (
    <section aria-label={t('graph.label')} className={styles.canvas}>
      <div className={styles.scroll}>
        <div className={styles.surface} style={{ width: layout.width, height: layout.height }}>
          <svg
            className={styles.edges}
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
            focusable="false"
          >
            {layout.edges.map((edge) => (
              <path key={edge.to} className={styles.edge} d={edge.path} />
            ))}
          </svg>
          {layout.nodes.map(({ node, x, y }) => (
            <GraphNode key={node.key} node={node} x={x} y={y} selected={node.key === selectedKey} />
          ))}
        </div>
      </div>
      <GraphFootnote
        partial={layout.nodes.some(({ node }) => node.partial)}
        missingTeammates={root.missingTeammates}
        teamListsTruncated={root.teamListsTruncated}
      />
    </section>
  )
}
