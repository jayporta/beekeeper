declare const workflowRunIdBrand: unique symbol

/**
 * The id of a workflow run: the name of its folder under a session's
 * `subagents/workflows/`. Only names {@link parseWorkflowRunId} accepts are
 * branded, so an id is safe to use as one path segment.
 */
export type WorkflowRunId = string & { readonly [workflowRunIdBrand]: true }

/** `wf_` followed by 1 to 64 letters, digits, underscores or hyphens. */
const WORKFLOW_RUN_ID_PATTERN = /^wf_[A-Za-z0-9_-]{1,64}$/

/**
 * Brands a folder name as a {@link WorkflowRunId} when it has the shape of
 * one. The check is strict so the id can't carry a path separator, a dot, or
 * a newline into a path built from it.
 *
 * @param folderName - A folder name found under `subagents/workflows/`.
 * @returns The branded id, or `null` when `folderName` isn't a run id.
 */
export function parseWorkflowRunId(folderName: string): WorkflowRunId | null {
  return WORKFLOW_RUN_ID_PATTERN.test(folderName) ? (folderName as WorkflowRunId) : null
}
