/** One model's tokens on one day. */
export interface DailyUsageModelDto {
  /** The normalized model id. Transcript-derived: render as plain text. */
  readonly model: string
  /** The total tokens across every billing class. */
  readonly tokens: number
}

/** The models that used tokens on one local calendar day. */
export interface DailyUsageDayDto {
  /** The local calendar day, `YYYY-MM-DD`. */
  readonly day: string
  /** Models with tokens that day, largest first, ties by model id. */
  readonly models: readonly DailyUsageModelDto[]
}

/** The sessions of a folder that leave a day's total incomplete, counted by reason. A session may count under more than one. */
export interface ProjectDailyUsagePartialDto {
  /** Sessions whose lead transcript couldn't be read or stat'd. */
  readonly unreadable: number
  /** Sessions with usage in the window and lines that couldn't be read. */
  readonly skippedLines: number
  /** Sessions with usage in the window and messages that have no timestamp. */
  readonly undated: number
  /** Sessions with a subagent transcript, or a subagents folder, that couldn't be read. */
  readonly unreadableSubagents: number
}

/**
 * One project folder's own tokens over a window, by local day and model.
 * Each message counts on the day it ran, so a session that began before the
 * window counts only its in-window messages.
 */
export interface ProjectDailyUsageDto {
  /** Every day of the window, oldest first, including days with no usage. */
  readonly days: readonly DailyUsageDayDto[]
  /** Why a day's total may be low. */
  readonly partial: ProjectDailyUsagePartialDto
}
