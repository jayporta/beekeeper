import type {
  ProjectDailyUsageDto,
  ProjectDailyUsagePartialDto
} from '../../../../../shared/ipc/projectDailyUsageDto'

/** Where one folder's daily usage stands. */
export type FolderDailyUsageState =
  | {
      /** The usage hasn't arrived. */
      readonly status: 'loading'
    }
  | {
      /** The folder's usage couldn't be loaded. */
      readonly status: 'error'
    }
  | {
      /** The folder's usage. */
      readonly status: 'ready'
      /** The usage. */
      readonly usage: ProjectDailyUsageDto
    }

/** The tokens of every folder on one day. */
export interface DailyUsageDay {
  /** The local calendar day, `YYYY-MM-DD`. */
  readonly day: string
  /** Tokens by normalized model id. Transcript-derived: render as plain text. */
  readonly byModel: ReadonlyMap<string, number>
  /** The tokens of every model. */
  readonly total: number
}

/** Several folders' daily usage added together, with how many folders are in each state. */
export interface DailyUsageSummary {
  /** Up to `dayCount` days, oldest first, ending on the latest day any ready folder returned. None when no folder is ready. */
  readonly days: readonly DailyUsageDay[]
  /** The tokens over every day. */
  readonly total: number
  /** How many folders are still loading. */
  readonly loading: number
  /** How many folders couldn't be read. */
  readonly failed: number
  /** Sessions that leave a day's total incomplete, added over the ready folders, by reason. */
  readonly partial: ProjectDailyUsagePartialDto
}

/**
 * Adds several folders' daily usage together. The window ends on the latest
 * day any ready folder returned and reaches back `dayCount` days, so folders
 * fetched on either side of midnight still line up; a day older than that is
 * dropped.
 *
 * @param states - Each folder's state.
 * @param dayCount - How many days the window holds.
 * @returns The summed days and how the folders stand.
 */
export function sumDailyUsage(
  states: readonly FolderDailyUsageState[],
  dayCount: number
): DailyUsageSummary {
  const byDay = new Map<string, Map<string, number>>()
  const partial = { unreadable: 0, skippedLines: 0, undated: 0, unreadableSubagents: 0 }
  let loading = 0
  let failed = 0

  for (const state of states) {
    if (state.status === 'loading') loading += 1
    else if (state.status === 'error') failed += 1
    else {
      partial.unreadable += state.usage.partial.unreadable
      partial.skippedLines += state.usage.partial.skippedLines
      partial.undated += state.usage.partial.undated
      partial.unreadableSubagents += state.usage.partial.unreadableSubagents
      for (const { day, models } of state.usage.days) {
        const sums = byDay.get(day) ?? new Map<string, number>()
        byDay.set(day, sums)
        for (const { model, tokens } of models) sums.set(model, (sums.get(model) ?? 0) + tokens)
      }
    }
  }

  const days = [...byDay.keys()]
    .sort()
    .slice(-dayCount)
    .map((day): DailyUsageDay => {
      const byModel = byDay.get(day) ?? new Map<string, number>()
      return { day, byModel, total: [...byModel.values()].reduce((sum, n) => sum + n, 0) }
    })
  return {
    days,
    total: days.reduce((sum, day) => sum + day.total, 0),
    loading,
    failed,
    partial
  }
}
