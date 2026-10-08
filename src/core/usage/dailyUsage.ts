/** A local calendar day, `YYYY-MM-DD`. */
export type DayKey = string

/** The tokens one model used on one day. */
export interface DailyUsageBucket {
  /** The local calendar day the tokens count on. */
  readonly day: DayKey
  /** The normalized model id (see `normalizeModelId`). */
  readonly model: string
  /** The total tokens across every billing class. */
  readonly tokens: number
}

/** One session's tokens by day and model, with what couldn't be counted. */
export interface SessionDailyUsage {
  /** Sorted by day, then model. One bucket per (day, model) with tokens above zero. */
  readonly buckets: readonly DailyUsageBucket[]
  /** Messages with no timestamp, left out of every bucket. */
  readonly undatedMessages: number
  /** Lines across every read transcript that couldn't be read as a valid record. */
  readonly skippedLines: number
  /** Subagent transcripts that couldn't be read. */
  readonly unreadableSubagents: number
}
