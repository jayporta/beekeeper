import { z } from 'zod'
import { toAgentLabel } from '../agentLabel'
import { isRecordObject } from '../isRecordObject'

/** The most phase titles a {@link WorkflowRunRecord} keeps. */
export const MAX_WORKFLOW_PHASES = 32

/** What beekeeper shows about one workflow run, read from its record file. */
export interface WorkflowRunRecord {
  /** The workflow's name, or `null` when it is absent or not a usable label. */
  readonly name: string | null
  /** Whether the run finished successfully (its status is `completed`). */
  readonly completed: boolean
  /** The titles of the run's phases, up to {@link MAX_WORKFLOW_PHASES}. */
  readonly phases: readonly string[]
}

/**
 * Collects the usable phase titles from an untrusted `phases` value.
 * @param phases - The record's `phases` field, of any shape.
 * @returns The first {@link MAX_WORKFLOW_PHASES} titles that are usable
 * labels, in order; `[]` when `phases` is not a list.
 */
function readPhaseTitles(phases: unknown): string[] {
  if (!Array.isArray(phases)) return []

  const titles: string[] = []
  for (const phase of phases as unknown[]) {
    if (titles.length === MAX_WORKFLOW_PHASES) break
    const title = isRecordObject(phase) ? toAgentLabel(phase.title) : null
    if (title !== null) titles.push(title)
  }
  return titles
}

/**
 * A workflow run's record, `<session>/workflows/<runId>.json`.
 *
 * Only the fields beekeeper shows are read, and none of them can fail the
 * parse: the name and each phase title are labels, shown to the reader, so
 * each goes through {@link toAgentLabel} (trimmed, normalized to NFC,
 * printable, within the label cap) and reads as absent or is dropped when it
 * isn't usable. A status other than `completed`, or none, reads as not
 * completed. Unknown keys, such as the workflow's script and result, are
 * stripped unread. Only an input that isn't an object fails the parse.
 */
export const workflowRunRecordSchema = z
  .object({
    workflowName: z.unknown().optional(),
    status: z.unknown().optional(),
    phases: z.unknown().optional()
  })
  .transform((record): WorkflowRunRecord => ({
    name: toAgentLabel(record.workflowName),
    completed: record.status === 'completed',
    phases: readPhaseTitles(record.phases)
  }))
