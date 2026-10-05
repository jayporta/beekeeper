import type { SessionDetailDto } from '../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import { GraphCanvas } from './graph/GraphCanvas'
import { useAgentGraph } from './graph/useAgentGraph'
import { AgentInspector } from './inspector/AgentInspector'
import styles from './SessionDetailBody.module.css'

/** Props for {@link SessionDetailBody}. */
interface SessionDetailBodyProps {
  /** The viewed session's agent tree and reports. */
  readonly detail: SessionDetailDto
  /** The viewed session. */
  readonly sessionRef: SessionRefDto
  /** The session's row in its folder's sessions list, or `null` when the list doesn't hold it. */
  readonly row: SessionRow | null
}

/**
 * The session's agent graph with the inspector for the selected agent beside
 * it. The graph is built once and shared, so the inspector reads the same
 * nodes, including the subagents of teammates the person has opened.
 *
 * @example
 * <SessionDetailBody detail={detail} sessionRef={ref} row={row} />
 */
export function SessionDetailBody({
  detail,
  sessionRef,
  row
}: SessionDetailBodyProps): React.JSX.Element {
  const graph = useAgentGraph({ detail, sessionRef, row })
  const selected =
    graph.layout.nodes.find(({ node }) => node.key === graph.selectedKey)?.node ?? graph.root

  return (
    <div className={styles.body}>
      <GraphCanvas graph={graph} />
      <AgentInspector node={selected} sessionRef={sessionRef} />
    </div>
  )
}
