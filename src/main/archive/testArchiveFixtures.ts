import { EMPTY_AGENT_SIGNALS_DTO } from '../../shared/ipc/emptyAgentSignals'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto, SessionSummaryDto } from '../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import type { ListItemEntry, SourceState } from './archiveStoreTypes'

/** The session the fixtures describe unless overridden. */
export const TEST_REF: SessionRefDto = {
  projectDirName: '-work-app',
  sessionId: '11111111-1111-4111-8111-111111111111'
}

/** A transcript state the fixtures use unless overridden. */
export const TEST_SOURCE: SourceState = { mtimeMs: 1_000, size: 500 }

/** A list item for {@link TEST_REF} whose summary is unreadable, unless overridden. */
export function testListItem(overrides: Partial<SessionListItemDto> = {}): SessionListItemDto {
  return {
    ...TEST_REF,
    modifiedMs: TEST_SOURCE.mtimeMs,
    sizeBytes: TEST_SOURCE.size,
    subagentCount: 0,
    workflows: null,
    agentTerms: [],
    workflowRunNames: [],
    summary: { ok: false, error: { code: 'unreadable' } },
    team: null,
    ...overrides
  }
}

/** A list item to store with the transcript state it was built from, for {@link TEST_REF} unless overridden. */
export function listEntry(
  item: SessionListItemDto = testListItem(),
  source: SourceState = TEST_SOURCE
): ListItemEntry {
  return { item, source }
}

/** A readable summary whose last message is at `latestMs`, or that has no timestamps when `null`. */
export function testOkSummary(latestMs: number | null): IpcResult<SessionSummaryDto> {
  return {
    ok: true,
    value: {
      title: null,
      usage: null,
      activity: latestMs === null ? null : { earliestMs: 0, latestMs },
      skippedLines: 0,
      role: { kind: 'lead' },
      model: null,
      limitHit: null,
      transcriptTokens: null,
      signals: EMPTY_AGENT_SIGNALS_DTO
    }
  }
}

/** A detail for {@link TEST_REF} with a lead and no subagents, whose lead task description is `padding`. */
export function testDetail(padding = ''): SessionDetailDto {
  return {
    sessionId: TEST_REF.sessionId,
    tree: {
      agentId: null,
      meta: { status: 'ok', meta: { agentType: 'lead', description: padding } },
      workflowRunId: null,
      children: []
    },
    lead: {
      tokenGroups: [],
      messageCount: 1,
      skippedLines: 0,
      fileTouches: [],
      fileListIncomplete: false,
      activity: null,
      signals: EMPTY_AGENT_SIGNALS_DTO
    },
    subagents: { ok: true, value: [] },
    reconciliation: {
      models: [],
      totals: { transcriptUSD: null, transcriptPartial: false, recordedUSD: null }
    },
    workflowRuns: []
  }
}
