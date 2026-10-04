import type { ProjectTotalsDto } from '../../../../shared/ipc/projectTotalsDto'
import type { FolderTotalsState } from './folderTotalsState'

/** A folder's totals with nothing in the window, unless overridden. */
export function testTotals(overrides: Partial<ProjectTotalsDto> = {}): ProjectTotalsDto {
  return {
    tokens: 0,
    usd: 0,
    sessions: 0,
    agents: 0,
    latest: null,
    partial: { withoutTokens: 0, withoutCost: 0, unreadable: 0, lowTokens: 0, undated: 0 },
    ...overrides
  }
}

/** A folder whose totals have arrived. */
export function readyTotals(
  overrides: Partial<ProjectTotalsDto> = {},
  refreshing = false
): FolderTotalsState {
  return { status: 'ready', totals: testTotals(overrides), refreshing }
}
