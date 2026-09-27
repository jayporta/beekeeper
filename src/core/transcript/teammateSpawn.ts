/** One teammate a transcript spawned. */
export interface TeammateSpawn {
  /** The teammate's name, which with the team joins the spawn to the teammate's own transcript. */
  readonly agentName: string
  /** The team the teammate joined, or `null` when the spawn named none. */
  readonly teamName: string | null
  /** The teammate's agent type, or `null` when the spawn recorded none. */
  readonly agentType: string | null
  /**
   * The id of the `Agent` call that spawned it, exactly as the transcript
   * wrote it, or `null` when the record carried no `tool_result` block or
   * several, or when its id was empty or longer than the block cap, which
   * drops the whole block.
   * Kept byte for byte because it joins a teammate to its spawning call, so
   * unlike the labels beside it, it is not sanitized: a consumer that shows
   * one has to make it safe to display.
   */
  readonly rawToolUseId: string | null
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
  /**
   * Whether a list hit its cap and dropped calls. It can over-report, since a
   * dropped call may be a repeat that would have merged away anyway, so it
   * means "may undercount" rather than "does".
   */
  readonly truncated: boolean
}
