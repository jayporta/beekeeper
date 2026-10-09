import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { WorkflowRunDto } from '../../../../../shared/ipc/workflowRunDto'
import { sessionKey } from '@renderer/features/sessions/sessionKey'
import type { AgentGraphNode, NodeWorkflow } from './agentGraphNode'
import { runMembers } from './runMembers'

/** One run's facts. A run's name is its record's name, or its id when the record has none or is missing. */
function runFacts({ runId, record }: WorkflowRunDto, duplicateName: boolean): NodeWorkflow {
  return {
    runId,
    name: record?.name ?? runId,
    completed: record?.completed ?? false,
    duplicateName,
    phases: record?.phases ?? []
  }
}

/**
 * Reads the facts of a session's workflow runs, and which of them share a name.
 *
 * @param runs - The session's runs from its detail.
 * @returns Each run's facts by run id.
 */
export function nodeWorkflows(runs: readonly WorkflowRunDto[]): ReadonlyMap<string, NodeWorkflow> {
  const facts = runs.map((run) => runFacts(run, false))
  const counts = new Map<string, number>()
  for (const { name } of facts) counts.set(name, (counts.get(name) ?? 0) + 1)
  return new Map(
    facts.map((run) => [run.runId, { ...run, duplicateName: (counts.get(run.name) ?? 0) > 1 }])
  )
}

/**
 * Finds a run's facts, falling back to a run with no record when the session's
 * detail doesn't list it.
 *
 * @param workflows - The session's runs' facts by run id.
 * @param runId - The run to find.
 * @returns The run's facts.
 */
export function workflowOf(
  workflows: ReadonlyMap<string, NodeWorkflow>,
  runId: string
): NodeWorkflow {
  return workflows.get(runId) ?? runFacts({ runId, record: null }, false)
}

/** Input for {@link workflowRunNodes}. */
interface WorkflowRunNodesInput {
  /** The session whose transcripts hold the runs' agents. */
  readonly ownerRef: SessionRefDto
  /** The session's runs' facts by run id. */
  readonly workflows: ReadonlyMap<string, NodeWorkflow>
  /** The agents of each run that sit at the root, by run id. */
  readonly agents: ReadonlyMap<string, readonly AgentGraphNode[]>
}

/**
 * Builds one node per run, each holding its agents. A run's tokens are the own
 * tokens of every member below its node, at any depth, added up, `null` when
 * none has any. A run is partial when any member is, or has no tokens, so a
 * total that leaves one out says so. Each member stays under its own parent.
 *
 * @param input - The owner, the runs' facts, and each run's agents.
 * @returns The run nodes, sorted by run id.
 */
export function workflowRunNodes(input: WorkflowRunNodesInput): readonly AgentGraphNode[] {
  const { ownerRef, workflows, agents } = input
  return [...agents.keys()].sort().map((runId) => {
    const children = agents.get(runId) ?? []
    const members = runMembers(children, runId)
    const workflow = workflowOf(workflows, runId)
    return {
      key: `run:${sessionKey(ownerRef)}:${runId}`,
      kind: 'workflow',
      name: workflow.name,
      agentType: null,
      model: null,
      tokens: members.reduce<number | null>(
        (total, { tokens }) => (tokens === null ? total : (total ?? 0) + tokens),
        null
      ),
      partial: members.some((agent) => agent.partial || agent.tokens === null),
      stopped: false,
      marks: null,
      subagentsNotLoaded: false,
      folder: null,
      selection: { kind: 'workflow', ownerRef, runId },
      workflow,
      children
    }
  })
}
