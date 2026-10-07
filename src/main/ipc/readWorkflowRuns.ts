import type { SubagentEntry } from '../../core/transcript/discoverSubagents'
import { captureSystemError } from '../../core/transcript/captureSystemError'
import { readWorkflowRun } from '../../core/transcript/readWorkflowRun'
import type { WorkflowRunId } from '../../core/transcript/workflowRunId'
import type { WorkflowRecordDto, WorkflowRunDto } from '../../shared/ipc/workflowRunDto'
import { distinctRunIds } from './distinctRunIds'

/**
 * Reads the record of one run, field by field, so no field a record gains
 * later crosses the bridge.
 * @param sessionDir - The session's directory.
 * @param runId - The run to read.
 * @returns The run's record, or `null` when it is missing, unusable, or
 * can't be read for a system reason.
 */
async function readRecord(
  sessionDir: string,
  runId: WorkflowRunId
): Promise<WorkflowRecordDto | null> {
  const read = await captureSystemError(() => readWorkflowRun(sessionDir, runId))
  if (!read.ok || !read.value.ok) return null
  const { name, completed, phases } = read.value.value
  return { name, completed, phases }
}

/**
 * Reads the record of every workflow run among a session's subagents.
 *
 * One run is produced per distinct run id, in run id order. Records are read
 * one at a time, so a session with many runs never holds many files open at
 * once. A run whose record is missing, a symlink, oversized, malformed, or
 * unreadable for a system reason (such as a permissions error) has a `null`
 * record, so one bad record never fails the session detail.
 *
 * @param sessionDir - The session's directory.
 * @param entries - The session's discovered subagents.
 * @returns One entry per run, or `[]` when no entry belongs to a run.
 */
export async function readWorkflowRuns(
  sessionDir: string,
  entries: readonly SubagentEntry[]
): Promise<WorkflowRunDto[]> {
  const runs: WorkflowRunDto[] = []
  for (const runId of distinctRunIds(entries)) {
    runs.push({ runId, record: await readRecord(sessionDir, runId) })
  }
  return runs
}
