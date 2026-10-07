import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { AgentGraphNode } from '../graph/agentGraphNode'
import { useSessionDetail } from '../useSessionDetail'
import { inspectionOf } from './inspectionOf'
import { inspectionTarget, type AgentSelection } from './inspectionTarget'
import { InspectorBody } from './InspectorBody'
import { InspectorFlags } from './InspectorFlags'
import { InspectorHeader } from './InspectorHeader'
import { InspectorPendingNote } from './InspectorPendingNote'

/** Props for {@link InspectedAgent}. */
interface InspectedAgentProps {
  /** The selected node. */
  readonly node: AgentGraphNode
  /** The node's selection, or `null` for the root. */
  readonly selection: AgentSelection | null
  /** The viewed session. */
  readonly sessionRef: SessionRefDto
}

/**
 * What the inspector shows for one agent, read from its owner session's
 * detail: who it is, and while that loads, once it can't be read, or once it
 * has loaded, its totals, files, worktree diff, and flags. Key it by the node,
 * so each agent starts with fresh state in the parts below it.
 *
 * @example
 * <InspectedAgent key={node.key} node={node} selection={node.selection} sessionRef={ref} />
 */
export function InspectedAgent({
  node,
  selection,
  sessionRef
}: InspectedAgentProps): React.JSX.Element {
  const target = inspectionTarget(selection, sessionRef)
  // The view and the graph's teammate expansions keep this entry fresh; a click must not re-parse it.
  const { data, isError } = useSessionDetail(target.ownerRef, { refetchOnMount: false })
  const inspection = inspectionOf(target, { data, isError })

  return (
    <>
      <InspectorHeader
        node={node}
        report={inspection.status === 'ready' ? inspection.report : null}
      />
      {inspection.status === 'loading' && <InspectorPendingNote loading />}
      {inspection.status === 'unreadable' && (
        <>
          <InspectorPendingNote loading={false} />
          <InspectorFlags stopped={node.stopped} partial={false} />
        </>
      )}
      {inspection.status === 'ready' && (
        <InspectorBody node={node} target={target} inspection={inspection} />
      )}
    </>
  )
}
