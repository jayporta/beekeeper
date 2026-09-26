/** One teammate a transcript spawned. */
export interface TeammateSpawn {
  /** The teammate's name, which with the team joins the spawn to the teammate's own transcript. */
  readonly agentName: string
  /** The team the teammate joined, or `null` when the spawn named none. */
  readonly teamName: string | null
  /** The teammate's agent type, or `null` when the spawn recorded none. */
  readonly agentType: string | null
  /** The id of the `Agent` call that spawned it, or `null` when the result carried none. */
  readonly toolUseId: string | null
}

/** One teammate a transcript stopped with `TaskStop`, paired with the team it most plausibly belonged to. */
export interface TeammateStop {
  /** The teammate's name, from the stop's `task_id`. */
  readonly agentName: string
  /**
   * The team the `task_id` stated (`name@team`), else the team of the most
   * recent observed spawn of that name, or `null` when this transcript observed none.
   */
  readonly teamName: string | null
}

/** The teammates a transcript spawned and stopped. */
export interface TranscriptTeamSpawns {
  /** Distinct (team, name) spawns in file order; a respawn keeps its first entry. */
  readonly spawns: readonly TeammateSpawn[]
  /** Distinct stopped teammate names in file order, whether or not a spawn matches; stops of shells and background agents are excluded. */
  readonly stops: readonly TeammateStop[]
  /** Whether a list hit its cap and dropped entries, so the lists undercount. */
  readonly truncated: boolean
}
