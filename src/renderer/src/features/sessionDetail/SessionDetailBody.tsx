import { useRef } from 'react'
import type { SessionDetailDto } from '../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { cardFigures } from '@renderer/features/sessions/cardFigures'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import { GraphCanvas } from './graph/GraphCanvas'
import { useAgentGraph } from './graph/useAgentGraph'
import { AgentInspector } from './inspector/AgentInspector'
import styles from './SessionDetailBody.module.css'
import { BreakdownCard } from './summary/BreakdownCard'
import { SignalsCard } from './summary/SignalsCard'
import { SummaryCards } from './summary/SummaryCards'
import { TopAgentsCard } from './summary/TopAgentsCard'

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
 * The session's summary cards, then its agent graph with the inspector for
 * the selected agent beside it. The graph is built once and shared, so the
 * inspector reads the same nodes, including the subagents of teammates the
 * person has opened, and the cards rank the agents the graph held before any
 * teammate was opened. A card's row selects its agent and moves focus into
 * the graph, whose region this view holds a ref to.
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
  const regionRef = useRef<HTMLDivElement>(null)
  const selected =
    graph.layout.nodes.find(({ node }) => node.key === graph.selectedKey)?.node ?? graph.root
  const teamTokens = row === null ? null : (cardFigures(row.item).figures?.tokens ?? null)

  return (
    <>
      <SummaryCards>
        <BreakdownCard detail={detail} />
        <TopAgentsCard graph={graph.base} teamTotal={teamTokens} regionRef={regionRef} />
        <SignalsCard graph={graph.base} regionRef={regionRef} />
      </SummaryCards>
      <div className={styles.body}>
        <GraphCanvas graph={graph} regionRef={regionRef} />
        <AgentInspector node={selected} sessionRef={sessionRef} />
      </div>
    </>
  )
}
