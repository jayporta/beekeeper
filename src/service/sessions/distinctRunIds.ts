import { compareCodeUnits } from '../../core/shared/compareCodeUnits'
import type { SubagentEntry } from '../../core/transcript/discoverSubagents'
import type { WorkflowRunId } from '../../core/transcript/workflowRunId'

/**
 * Lists the workflow runs a session's subagents belong to.
 *
 * @param entries - The session's discovered subagents.
 * @returns One id per distinct run, in code unit order; `[]` when no entry
 * belongs to a run.
 */
export function distinctRunIds(entries: readonly SubagentEntry[]): WorkflowRunId[] {
  const runIds = new Set<WorkflowRunId>()
  for (const { workflowRunId } of entries) {
    if (workflowRunId !== null) runIds.add(workflowRunId)
  }
  return [...runIds].sort(compareCodeUnits)
}
