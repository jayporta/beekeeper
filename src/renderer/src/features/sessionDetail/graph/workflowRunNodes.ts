import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { WorkflowRunDto } from '../../../../../shared/ipc/workflowRunDto'
import { sessionKey } from '@renderer/features/sessions/sessionKey'
import type { AgentGraphNode, NodeWorkflow } from './agentGraphNode'

/**
 * Reads the facts of a session's workflow runs. A run's name is its record's
 * name, or its id when the record has none or is missing.
 *
 * @param runs - The session's runs from its detail.
 * @returns Each run's facts by run id.
 */
export function nodeWorkflows(runs: readonly WorkflowRunDto[]): ReadonlyMap<string, NodeWorkflow> {
  const named = runs.map(({ runId, record }) => ({ runId, record, name: record?.name ?? runId }))
  const counts = new Map<string, number>()
  for (const { name } of named) counts.set(name, (counts.get(name) ?? 0) + 1)
  return new Map(
    named.map(({ runId, record, name }) => [
      runId,
      {
        runId,
        name,
        completed: record?.completed ?? false,
        duplicateName: (counts.get(name) ?? 0) > 1,
        phases: record?.phases ?? []
      }
    ])
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
  return (
    workflows.get(runId) ?? {
      runId,
      name: runId,
      completed: false,
      duplicateName: false,
      phases: []
    }
  )
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
 * Builds one node per run, each holding its agents. A run's tokens are its
 * agents' own tokens added up, `null` when none has any. A run is partial when
 * any agent is, or has no tokens, so a total that leaves one out says so.
 *
 * @param input - The owner, the runs' facts, and each run's agents.
 * @returns The run nodes, sorted by run id.
 */
export function workflowRunNodes(input: WorkflowRunNodesInput): readonly AgentGraphNode[] {
  const { ownerRef, workflows, agents } = input
  return [...agents.keys()].sort().map((runId) => {
    const children = agents.get(runId) ?? []
    const workflow = workflowOf(workflows, runId)
    return {
      key: `run:${sessionKey(ownerRef)}:${runId}`,
      kind: 'workflow',
      name: workflow.name,
      agentType: null,
      model: null,
      tokens: children.reduce<number | null>(
        (total, { tokens }) => (tokens === null ? total : (total ?? 0) + tokens),
        null
      ),
      partial: children.some((agent) => agent.partial || agent.tokens === null),
      stopped: false,
      subagentsNotLoaded: false,
      folder: null,
      selection: { kind: 'workflow', ownerRef, runId },
      workflow,
      children
    }
  })
}
