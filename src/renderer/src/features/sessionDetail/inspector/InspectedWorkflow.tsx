import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { AgentGraphNode } from '../graph/agentGraphNode'
import { reportTokens } from '../graph/reportFacts'
import { useSessionDetail } from '../useSessionDetail'
import { InspectorFootnote } from './InspectorFootnote'
import { InspectorHeader } from './InspectorHeader'
import { InspectorPendingNote } from './InspectorPendingNote'
import type { InspectorReason } from './inspectorReasons'
import { reportCost } from './reportCost'
import { readableReports, runReport, runTokensPartial } from './runReport'
import { TokenRows } from './TokenRows'
import { WorkflowPhases } from './WorkflowPhases'
import { WorkflowTotals } from './WorkflowTotals'

/** Props for {@link InspectedWorkflow}. */
interface InspectedWorkflowProps {
  /** The selected run node. */
  readonly node: AgentGraphNode
  /** The session whose detail holds the run's agents. */
  readonly ownerRef: SessionRefDto
}

/**
 * What the inspector shows for a workflow run, read from its owner session's
 * detail: who it is, and while that loads or once it can't be read, the same
 * note an agent gets. Once loaded, its totals, its phases, and its tokens by
 * class over all its agents. It shows no files or flags, since a run is never
 * stopped and its "¹" marks and footnote say where its tokens may be low. Key
 * it by the owner session, so a different owner mounts a fresh reader.
 *
 * @example
 * <InspectedWorkflow key={sessionKey(ownerRef)} node={node} ownerRef={ownerRef} />
 */
export function InspectedWorkflow({ node, ownerRef }: InspectedWorkflowProps): React.JSX.Element {
  // The view and the graph keep this entry fresh; a click must not re-parse it.
  const { data, isError } = useSessionDetail(ownerRef, { refetchOnMount: false })

  if (data === undefined) {
    return (
      <>
        <InspectorHeader node={node} report={null} />
        <InspectorPendingNote loading={!isError} workflow />
      </>
    )
  }

  const agentIds = node.children.flatMap(({ selection }) =>
    selection?.kind === 'subagent' ? [selection.agentId] : []
  )
  const reports = readableReports(data, agentIds)
  const report = runReport(reports)
  const tokens = reportTokens(report)
  const cost = reportCost(report)
  const partial = runTokensPartial(reports, agentIds.length)
  const reasons = new Set<InspectorReason>()
  if (report.skippedLines > 0) reasons.add('unreadableLines')
  if (cost.partial) reasons.add('unpricedTokens')
  if (partial) reasons.add('belowIncomplete')

  return (
    <>
      <InspectorHeader node={node} report={report} />
      <WorkflowTotals tokens={tokens} partial={partial} agents={agentIds.length} cost={cost} />
      <WorkflowPhases phases={node.workflow?.phases ?? []} />
      {tokens !== null && <TokenRows report={report} tokens={tokens} />}
      <InspectorFootnote reasons={reasons} />
    </>
  )
}
