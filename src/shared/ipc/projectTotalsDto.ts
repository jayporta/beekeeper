/** Every window a project's totals can cover. */
export const TOTALS_WINDOWS = ['7d', '30d'] as const

/** How far back a project's totals reach. */
export type TotalsWindowDto = (typeof TOTALS_WINDOWS)[number]

/** The sessions of a folder that leave a total incomplete, counted by reason. A session may count under more than one. */
export interface ProjectTotalsPartialDto {
  /** Sessions with no token figure at all, recorded or read from the transcript. */
  readonly withoutTokens: number
  /** Sessions with no recorded cost. */
  readonly withoutCost: number
  /** Sessions whose transcript or summary couldn't be read. */
  readonly unreadable: number
  /** Sessions whose tokens may be low: unreadable transcript lines, an unreadable subagents folder, or a figure that leaves out subagents. Each counts once. */
  readonly lowTokens: number
  /** Sessions with no timestamps, counted by when their file was last written. */
  readonly undated: number
}

/** The lead or solo session of a folder that was active last in the window. */
export interface ProjectTotalsLatestDto {
  /** The session's id. */
  readonly sessionId: string
  /** Its title, or `null` when it has none. Transcript-derived: render as plain text. */
  readonly title: string | null
  /** When it was last active, in milliseconds since the Unix epoch. */
  readonly latestMs: number
}

/**
 * What one project folder's own sessions add up to over a window. Only the
 * folder's own sessions count, so a project that has worktree folders sums the
 * folders' totals. Every figure is a session's own: nothing is counted twice.
 */
export interface ProjectTotalsDto {
  /** The tokens of every session in the window. */
  readonly tokens: number
  /** The recorded cost of every session in the window, in US dollars. */
  readonly usd: number
  /** How many lead and solo sessions are in the window. A teammate is not a session. */
  readonly sessions: number
  /** How many agents are in the window: every session, teammates included, and each one's subagents. */
  readonly agents: number
  /** The lead or solo session active last in the window, or `null` when none has an activity time. */
  readonly latest: ProjectTotalsLatestDto | null
  /** Why the totals may be low. */
  readonly partial: ProjectTotalsPartialDto
}
