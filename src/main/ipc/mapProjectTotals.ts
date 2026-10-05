import type { ProjectTotalsDto } from '../../shared/ipc/projectTotalsDto'
import type { FolderTotals } from '../overview/folderTotals'

/**
 * Maps a folder's totals onto their transfer shape, field by field.
 *
 * @param totals - The folder's totals.
 * @returns The DTO.
 */
export function mapProjectTotals(totals: FolderTotals): ProjectTotalsDto {
  const { partial, latest } = totals
  return {
    tokens: totals.tokens,
    usd: totals.usd,
    sessions: totals.sessions,
    agents: totals.agents,
    latest:
      latest === null
        ? null
        : { sessionId: latest.sessionId, title: latest.title, latestMs: latest.latestMs },
    partial: {
      withoutTokens: partial.withoutTokens,
      withoutCost: partial.withoutCost,
      unreadable: partial.unreadable,
      lowTokens: partial.lowTokens,
      uncountedSubagents: partial.uncountedSubagents,
      undated: partial.undated
    }
  }
}
