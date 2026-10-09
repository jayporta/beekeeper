import type { AgentGraphNode } from '../graph/agentGraphNode'
import { reportTokens } from '../graph/reportFacts'
import { FilesTouched } from './FilesTouched'
import type { Inspection } from './inspectionOf'
import type { InspectionTarget } from './inspectionTarget'
import { InspectorFlags } from './InspectorFlags'
import { InspectorFootnote } from './InspectorFootnote'
import { inspectorReasons } from './inspectorReasons'
import { InspectorSignals } from './InspectorSignals'
import { InspectorTotals } from './InspectorTotals'
import { ReportedCostNote } from './ReportedCostNote'
import { reportCost } from './reportCost'
import { rollupBelow } from './rollupBelow'
import { TokenRows } from './TokenRows'
import { WorktreeDiffBox } from './WorktreeDiffBox'

/** Props for {@link InspectorBody}. */
interface InspectorBodyProps {
  /** The inspected node. */
  readonly node: AgentGraphNode
  /** Whose detail the inspection read. */
  readonly target: InspectionTarget
  /** The agent's report and worktree branch. */
  readonly inspection: Extract<Inspection, { status: 'ready' }>
}

/**
 * Everything the inspector knows about an agent whose report has loaded: its
 * totals, Claude Code's own cost estimate when the telemetry receiver has one, tokens by class, files touched, worktree diff, signals, flags, and the
 * footnote that explains each "¹". The worktree box is for a subagent that ran
 * on a worktree branch, and for an agent in a session of its own, which shows
 * one only when it shares a worktree with a subagent of the lead.
 *
 * @example
 * <InspectorBody node={node} target={target} inspection={inspection} />
 */
export function InspectorBody({ node, target, inspection }: InspectorBodyProps): React.JSX.Element {
  const { report, worktreeBranch, subagentsUnreadable } = inspection
  const tokens = reportTokens(report)
  const cost = reportCost(report)
  const rollup = rollupBelow(node)
  const reasons = inspectorReasons({
    report,
    cost,
    rollup,
    partial: node.partial,
    subagentsUnreadable
  })

  return (
    <>
      <InspectorTotals
        tokens={tokens}
        cost={cost}
        rollup={rollup}
        unreadableLines={report.skippedLines > 0}
        subagentsUnreadable={subagentsUnreadable}
      />
      <ReportedCostNote sessionId={target.ownerRef.sessionId} agentId={target.agentId} />
      {tokens !== null && <TokenRows report={report} tokens={tokens} />}
      <FilesTouched report={report} />
      {target.agentId === null && node.kind === 'teammate' && (
        <WorktreeDiffBox sessionRef={target.ownerRef} agentId={null} branch={null} />
      )}
      {target.agentId !== null && worktreeBranch !== null && (
        <WorktreeDiffBox
          sessionRef={target.ownerRef}
          agentId={target.agentId}
          branch={worktreeBranch}
        />
      )}
      <InspectorSignals signals={report.signals} showKills={target.agentId === null} />
      <InspectorFlags stopped={node.stopped} partial={node.partial} />
      <InspectorFootnote reasons={reasons} />
    </>
  )
}
