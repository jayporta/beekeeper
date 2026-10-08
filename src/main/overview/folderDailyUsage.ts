import { compareCodeUnits } from '../../core/shared/compareCodeUnits'
import type { DayKey, SessionDailyUsage } from '../../core/usage/dailyUsage'
import type { ProjectDailyUsageDto } from '../../shared/ipc/projectDailyUsageDto'

/** What reading one session of a folder gave. */
export type SessionDailyOutcome =
  /** The session's lead transcript couldn't be read. */
  | { readonly ok: false }
  | {
      readonly ok: true
      /** The session's usage on every day it ran. */
      readonly usage: SessionDailyUsage
      /** Whether the session's subagents folder was listed. */
      readonly subagentsListed: boolean
    }

/** Options for {@link folderDailyUsage}. */
export interface FolderDailyUsageOptions {
  /** The window's day keys, oldest first. */
  readonly days: readonly DayKey[]
  /** The outcome of each session read. */
  readonly sessions: readonly SessionDailyOutcome[]
}

/**
 * Adds up one folder's sessions by day and model over a window. Only buckets
 * on the window's days count, and every day is listed, quiet or not. Each
 * session counts at most once under each partial reason. Unreadable lines and
 * undated messages count unless every day the session has usage on is outside
 * the window, so a session with no usage at all counts, since what it could not
 * read may have been in the window. An unreadable session or subagent always
 * counts.
 *
 * @param options - The window's days and the sessions' outcomes.
 * @returns The folder's usage for the window.
 */
export function folderDailyUsage(options: FolderDailyUsageOptions): ProjectDailyUsageDto {
  const byDay = new Map<DayKey, Map<string, number>>(options.days.map((day) => [day, new Map()]))
  const partial = { unreadable: 0, skippedLines: 0, undated: 0, unreadableSubagents: 0 }

  for (const session of options.sessions) {
    if (!session.ok) {
      partial.unreadable += 1
      continue
    }
    const { usage, subagentsListed } = session
    // A session read only for the slack, with usage on days outside the window alone, leaves no figure low.
    const outsideWindow =
      usage.buckets.length > 0 && usage.buckets.every(({ day }) => !byDay.has(day))
    if (!outsideWindow && usage.skippedLines > 0) partial.skippedLines += 1
    if (!outsideWindow && usage.undatedMessages > 0) partial.undated += 1
    if (usage.unreadableSubagents > 0 || !subagentsListed) partial.unreadableSubagents += 1

    for (const { day, model, tokens } of usage.buckets) {
      const models = byDay.get(day)
      if (models !== undefined) models.set(model, (models.get(model) ?? 0) + tokens)
    }
  }

  return {
    days: options.days.map((day) => ({
      day,
      models: [...(byDay.get(day) ?? [])]
        .map(([model, tokens]) => ({ model, tokens }))
        .sort((a, b) => b.tokens - a.tokens || compareCodeUnits(a.model, b.model))
    })),
    partial
  }
}
