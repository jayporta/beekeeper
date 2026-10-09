import type { AgentReportDto } from '../../shared/ipc/agentDto'
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
    archived: false,
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
    workflowRuns: [],
    archived: false
  }
}

/** A list item with every optional part of a summary and every kind of agent term set. */
export function testPopulatedListItem(): SessionListItemDto {
  return testListItem({
    modifiedMs: 5,
    subagentCount: 2,
    workflows: { runs: 1, agents: 1 },
    agentTerms: [
      { name: 'scout', description: null, agentType: 'Explore' },
      { name: null, description: 'Find the bug', agentType: 'code-reviewer' }
    ],
    workflowRunNames: ['nightly'],
    summary: {
      ok: true,
      value: {
        title: 'Fix the bug',
        usage: { totalUSD: 1.5, totalTokens: 1_200 },
        activity: { earliestMs: 1, latestMs: 5 },
        skippedLines: 2,
        role: { kind: 'agent', agentType: 'Explore', agentName: 'scout', teamName: 'blue' },
        model: 'claude-opus-4',
        limitHit: { window: 'fiveHour', resetsAtMs: 9 },
        transcriptTokens: 1_000,
        signals: {
          toolErrors: 3,
          longestErrorStreak: 2,
          longestBashRepeat: 1,
          compactions: 1,
          agentsKilled: 1,
          longestToolWait: { ms: 4_000, tool: 'Bash' },
          partial: true
        }
      }
    }
  })
}

/** An agent report with every kind of price, file touch, and signal set. */
export function testPopulatedReport(): AgentReportDto {
  const tokens = { input: 1, output: 2, cacheRead: 3, cacheWrite5m: 4, cacheWrite1h: 5 }
  return {
    tokenGroups: [
      { model: 'm', speed: 'standard', tokens, price: { kind: 'priced', usd: 0.5 } },
      { model: 'm', speed: 'fast', tokens, price: { kind: 'unpriced', reason: 'unknown-speed' } },
      { model: 'n', speed: 'standard', tokens, price: { kind: 'free' } }
    ],
    messageCount: 3,
    skippedLines: 1,
    fileTouches: [
      { filePath: '/work/app/a.ts', operation: 'edit', source: 'edit-write' },
      { filePath: '/work/app/b.ts', operation: 'delete', source: 'bash' }
    ],
    fileListIncomplete: true,
    activity: { earliestMs: 1, latestMs: 9, activeMs: 5 },
    signals: {
      toolErrors: 2,
      longestErrorStreak: 1,
      longestBashRepeat: 3,
      compactions: 1,
      agentsKilled: 1,
      longestToolWait: { ms: 100, tool: 'Bash' },
      partial: true
    }
  }
}

/** A detail with a nested tree of every meta status, subagent reports good and bad, and workflow runs. */
export function testPopulatedDetail(): SessionDetailDto {
  return {
    ...testDetail(),
    tree: {
      agentId: null,
      meta: { status: 'absent' },
      workflowRunId: null,
      children: [
        {
          agentId: 'a1',
          meta: {
            status: 'ok',
            meta: {
              agentType: 'Explore',
              description: 'Find the bug',
              model: 'claude-opus-4',
              toolUseId: 'toolu_1',
              spawnDepth: 0,
              stoppedByUser: true,
              worktreeBranch: 'fix/bug',
              teamName: 'blue',
              name: 'scout'
            }
          },
          workflowRunId: 'run-1',
          children: [
            {
              agentId: 'a2',
              meta: { status: 'error', reason: 'invalid-json' },
              workflowRunId: null,
              children: []
            }
          ]
        }
      ]
    },
    lead: testPopulatedReport(),
    subagents: {
      ok: true,
      value: [
        { agentId: 'a1', report: { ok: true, value: testPopulatedReport() } },
        { agentId: 'a2', report: { ok: false, error: { code: 'unreadable' } } }
      ]
    },
    workflowRuns: [
      { runId: 'run-1', record: { name: 'nightly', completed: true, phases: ['plan', 'build'] } },
      { runId: 'run-2', record: null }
    ]
  }
}
