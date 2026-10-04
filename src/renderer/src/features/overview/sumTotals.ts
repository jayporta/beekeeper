import type {
  ProjectTotalsDto,
  ProjectTotalsLatestDto,
  ProjectTotalsPartialDto
} from '../../../../shared/ipc/projectTotalsDto'
import type { FolderTotalsState } from './folderTotalsState'
import { partialReasonsOf } from './partialReasons'

/** Several folders' totals added together, with how many of the folders are in each state. */
export interface AggregateTotals {
  /** The tokens of every folder that has totals. */
  readonly tokens: number
  /** The recorded cost of every folder that has totals, in US dollars. */
  readonly usd: number
  /** How many lead and solo sessions the folders hold in the window. */
  readonly sessions: number
  /** How many agents the folders hold in the window. */
  readonly agents: number
  /** The lead or solo session active last in any folder, or `null`. */
  readonly latest: ProjectTotalsLatestDto | null
  /** Sessions that leave the totals incomplete, added over the folders, by reason. */
  readonly partial: ProjectTotalsPartialDto
  /** How many folders have totals, are still loading, or couldn't be read. */
  readonly folders: { readonly ready: number; readonly loading: number; readonly failed: number }
  /** Whether any folder's figures are the other window's, shown until this window's arrive. */
  readonly refreshing: boolean
}

const NO_PARTIAL: ProjectTotalsPartialDto = {
  withoutTokens: 0,
  withoutCost: 0,
  unreadable: 0,
  lowTokens: 0,
  undated: 0
}

function laterOf(
  a: ProjectTotalsLatestDto | null,
  b: ProjectTotalsLatestDto | null
): ProjectTotalsLatestDto | null {
  if (a === null || b === null) return a ?? b
  if (a.latestMs !== b.latestMs) return a.latestMs > b.latestMs ? a : b
  return a.sessionId <= b.sessionId ? a : b
}

function addPartial(
  a: ProjectTotalsPartialDto,
  b: ProjectTotalsPartialDto
): ProjectTotalsPartialDto {
  return {
    withoutTokens: a.withoutTokens + b.withoutTokens,
    withoutCost: a.withoutCost + b.withoutCost,
    unreadable: a.unreadable + b.unreadable,
    lowTokens: a.lowTokens + b.lowTokens,
    undated: a.undated + b.undated
  }
}

/**
 * Adds folders' totals together. A folder still loading, or that couldn't be
 * read, adds nothing and is counted, so the result says how complete it is.
 *
 * @param states - Each folder's state.
 * @returns The sums and the folder counts.
 */
export function sumTotals(states: readonly FolderTotalsState[]): AggregateTotals {
  let tokens = 0
  let usd = 0
  let sessions = 0
  let agents = 0
  let latest: ProjectTotalsLatestDto | null = null
  let partial = NO_PARTIAL
  let refreshing = false
  const folders = { ready: 0, loading: 0, failed: 0 }

  for (const state of states) {
    if (state.status === 'loading') {
      folders.loading += 1
    } else if (state.status === 'error') {
      folders.failed += 1
    } else {
      folders.ready += 1
      const totals: ProjectTotalsDto = state.totals
      tokens += totals.tokens
      usd += totals.usd
      sessions += totals.sessions
      agents += totals.agents
      latest = laterOf(latest, totals.latest)
      partial = addPartial(partial, totals.partial)
      refreshing ||= state.refreshing
    }
  }
  return { tokens, usd, sessions, agents, latest, partial, folders, refreshing }
}

/** What a group of folders' totals come to, for showing. */
export type TotalsStatus = 'loading' | 'error' | 'ready'

/**
 * Says what to show for a sum: its figures once any folder has totals, else
 * a loading state while a folder is still loading, else an error when every
 * folder failed. A sum of no folders is ready, with zero totals.
 *
 * @param totals - The sum.
 * @returns The state to show.
 */
export function totalsStatus(totals: AggregateTotals): TotalsStatus {
  const { ready, loading, failed } = totals.folders
  if (ready > 0) return 'ready'
  if (loading > 0) return 'loading'
  return failed > 0 ? 'error' : 'ready'
}

/**
 * Whether a sum's tokens and cost may be low: some session leaves them
 * incomplete, or a folder is missing from them.
 *
 * @param totals - The sum.
 * @returns `true` when they may be low.
 */
export function isPartial(totals: AggregateTotals): boolean {
  return partialReasonsOf(totals).length > 0
}

/**
 * Whether a sum's session and agent counts may be low: a folder is missing
 * from them, or a session couldn't be read or dated.
 *
 * @param totals - The sum.
 * @returns `true` when the counts may be low.
 */
export function areCountsPartial(totals: AggregateTotals): boolean {
  const { partial, folders } = totals
  return folders.loading > 0 || folders.failed > 0 || partial.unreadable > 0 || partial.undated > 0
}
