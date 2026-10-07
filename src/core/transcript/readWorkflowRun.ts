import { join } from 'node:path'
import { err, ok, type Result } from '../shared/result'
import { readBoundedJsonFile, type BoundedJsonErrorReason } from './readBoundedJsonFile'
import { workflowRunRecordSchema, type WorkflowRunRecord } from './schemas/workflowRunRecord'
import type { WorkflowRunId } from './workflowRunId'

/** The largest workflow run record this reads. */
const MAX_RUN_RECORD_BYTES = 2 * 1024 * 1024

/**
 * Why a workflow run's record couldn't be read into a
 * {@link WorkflowRunRecord}: any {@link BoundedJsonErrorReason}, or
 * `invalid-shape` when the JSON isn't an object.
 */
export type WorkflowRunRecordErrorReason = BoundedJsonErrorReason | 'invalid-shape'

/** Why {@link readWorkflowRun} could not produce a {@link WorkflowRunRecord}. */
export interface WorkflowRunRecordError {
  readonly reason: WorkflowRunRecordErrorReason
}

/**
 * Reads one workflow run's record, `<sessionDir>/workflows/<runId>.json`.
 *
 * The path is built from a validated {@link WorkflowRunId}, so it can't
 * leave the `workflows` folder. The file is read through
 * {@link readBoundedJsonFile} with a {@link MAX_RUN_RECORD_BYTES} cap, then
 * reduced by {@link workflowRunRecordSchema}. A missing, symlinked,
 * non-regular, oversized or malformed record is reported as an {@link err}
 * rather than thrown, since a run with no usable record still belongs in the
 * session, just unnamed.
 *
 * @param sessionDir - The session's directory.
 * @param runId - The run whose record to read.
 * @returns `ok` with the record, or an `err` describing why it couldn't be
 * read.
 * @throws {Error} When the file exists but can't be read for a reason other
 * than the ones above, such as a permissions error. Callers that must
 * isolate this failure to one run should catch it and capture it as a
 * `Result` (see `captureSystemError`).
 */
export async function readWorkflowRun(
  sessionDir: string,
  runId: WorkflowRunId
): Promise<Result<WorkflowRunRecord, WorkflowRunRecordError>> {
  const raw = await readBoundedJsonFile(
    join(sessionDir, 'workflows', `${runId}.json`),
    MAX_RUN_RECORD_BYTES
  )
  if (!raw.ok) return raw

  const result = workflowRunRecordSchema.safeParse(raw.value)
  return result.success ? ok(result.data) : err({ reason: 'invalid-shape' })
}
