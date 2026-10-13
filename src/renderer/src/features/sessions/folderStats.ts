import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { folderTotals, type TotalsSession } from '../../../../shared/usage/folderTotals'
import {
  FIGURES_AFFECTED_BY_COUNT,
  countReasonsOf,
  figuresMarkedBy,
  type CountReason,
  type PartialFigure
} from '@renderer/components/countReasons'

/** What every session in a folder adds up to. */
export interface FolderStats {
  /** How many lead and solo sessions the folder holds. A teammate is not a session. */
  readonly sessions: number
  /** The tokens of every session of the folder. */
  readonly tokens: number
  /** The recorded cost of every session of the folder, in US dollars. */
  readonly usd: number
  /** How many agents: every session of the folder, teammates included, and each one's subagents. */
  readonly agents: number
  /** The last activity time of the most recently active lead or solo session, or `null` when none has timestamps. */
  readonly latestMs: number | null
  /** Why a figure may be low. Without `undated`, which means nothing without a window. */
  readonly reasons: readonly CountReason[]
  /** For each figure, whether a reason leaves it low. */
  readonly partial: Readonly<Record<PartialFigure, boolean>>
}

function toTotalsSession(item: SessionListItemDto): TotalsSession {
  return {
    sessionId: item.sessionId,
    mtimeMs: item.modifiedMs,
    subagentCount: item.subagentCount,
    summary: item.summary.ok ? item.summary.value : null
  }
}

/**
 * Adds up every session of a folder in a session list: no time window, so the
 * figures match the list. Sessions from other folders, such as teammates
 * nested under a lead, are left out. Archived sessions count.
 *
 * @param items - The folder's session list.
 * @param dirName - The folder to add up, exactly as on disk.
 * @returns The folder's figures and why they may be low.
 */
export function folderStats(items: readonly SessionListItemDto[], dirName: string): FolderStats {
  const sessions = items.filter((item) => item.projectDirName === dirName).map(toTotalsSession)
  const totals = folderTotals({ sessions, nowMs: 0, windowMs: Number.POSITIVE_INFINITY })
  const reasons = countReasonsOf(totals.partial).filter((reason) => reason !== 'undated')

  return {
    sessions: totals.sessions,
    tokens: totals.tokens,
    usd: totals.usd,
    agents: totals.agents,
    latestMs: totals.latest?.latestMs ?? null,
    reasons,
    partial: figuresMarkedBy(reasons, FIGURES_AFFECTED_BY_COUNT)
  }
}
