/** Where a subagent was spawned from, for choosing the repo and base of its worktree diff. */
export interface SpawnContext {
  /** The absolute working directory of the record that spawned it. */
  readonly cwd: string
  /** The branch checked out at the spawn, or `undefined` when there was no named branch (`HEAD`). */
  readonly baseBranch: string | undefined
  /**
   * Whether the context was inferred rather than read from the record that
   * spawned this subagent: taken from the last named branch, and that
   * record's cwd, in the nearest ancestor's transcript or the lead's.
   */
  readonly inferred: boolean
}
