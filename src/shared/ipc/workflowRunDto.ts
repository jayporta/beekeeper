/** What a workflow run's record file says about the run. Transcript-derived: render it as plain text. */
export interface WorkflowRecordDto {
  /** The workflow's name, or `null` when the record has none. */
  readonly name: string | null
  /** Whether the run finished successfully. */
  readonly completed: boolean
  /** The titles of the run's phases, in order, capped in number. */
  readonly phases: readonly string[]
}

/** One workflow run in a session, with its record when one could be read. */
export interface WorkflowRunDto {
  /** The run's id, its folder name under `subagents/workflows/`. */
  readonly runId: string
  /** The run's record, or `null` when it is missing or unusable. */
  readonly record: WorkflowRecordDto | null
}

/** How many workflow runs a session has and how many agents ran inside them. */
export interface WorkflowCountsDto {
  /** The number of distinct runs. */
  readonly runs: number
  /** The number of agents that ran inside a run. They are counted in the session's subagent count too. */
  readonly agents: number
}
