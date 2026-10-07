import type { QueryClient } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import type { AgentReportDto, PriceDto } from '../../../../../shared/ipc/agentDto'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import type { WorktreeDiffsDto } from '../../../../../shared/ipc/worktreeDiffDto'
import type { WorktreePatchDto } from '../../../../../shared/ipc/worktreePatchDto'
import { testRow } from '@renderer/features/sessions/testSessionRows'
import { installBeekeeperApi, type TestBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper, createTestQueryClient } from '@renderer/testQueryWrapper'
import { SCENE_ITEMS, SCENE_SESSION } from '../graph/testGraphScene'
import { SessionDetailBody } from '../SessionDetailBody'
import { testDetail, testMeta, testNode, testReport, testTokenGroup } from '../testSessionDetail'

const MIN = 60_000
/** When the scene lead's activity starts. */
export const SCENE_START = Date.parse('2026-01-15T11:00:00Z')

/**
 * The inspector's "started" fact for a time, as the English locale formats it.
 *
 * @param ms - The start, in epoch milliseconds.
 * @returns For example `started Jan 15, 2026, 11:00 AM`, in the viewer's time zone.
 */
export function startedFact(ms: number): string {
  const when = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(ms)
  return `started ${when}`
}

/**
 * Reads the inspector's facts line with its separators normalized to ` · `.
 *
 * @param pattern - Text the facts line contains.
 * @returns The line's text.
 */
export function factsText(pattern: RegExp): string {
  return (inspector().getByText(pattern).textContent ?? '').replace(/\s*·\s*/g, ' · ')
}

/** A token group priced at `usd`. */
export function pricedGroup(
  tokens: Parameters<typeof testTokenGroup>[0],
  price: PriceDto = { kind: 'priced', usd: 2.5 }
): ReturnType<typeof testTokenGroup> {
  return { ...testTokenGroup(tokens), price }
}

/** The scene lead's report: 1,600 tokens costing $2.50 over 90 minutes, 12 messages, and two files. */
export const LEAD_REPORT: AgentReportDto = testReport({
  tokenGroups: [
    pricedGroup({ input: 1000, output: 400, cacheRead: 100, cacheWrite5m: 60, cacheWrite1h: 40 })
  ],
  messageCount: 12,
  activity: { earliestMs: SCENE_START, latestMs: SCENE_START + 90 * MIN, activeMs: 60 * MIN },
  fileTouches: [
    { filePath: '/repo/src/a.ts', operation: 'edit', source: 'edit-write' },
    { filePath: '/repo/b.ts', operation: 'create', source: 'bash' }
  ]
})

/** The scene lead's detail: lead report above, and subagents `scout` (40 tokens) and `reader`. */
export const LEAD_DETAIL: SessionDetailDto = testDetail({
  lead: LEAD_REPORT,
  children: [
    testNode('a1', { meta: testMeta({ name: 'scout', agentType: 'Explore' }) }),
    testNode('a2', { meta: testMeta({ name: 'reader', agentType: 'Explore' }) })
  ],
  reports: { a1: testReport({ tokenGroups: [pricedGroup({ output: 40 })], messageCount: 3 }) }
})

/** What `renderInspectorScene` shows. */
interface InspectorSceneOptions {
  /** The lead's detail. Defaults to {@link LEAD_DETAIL}. */
  readonly detail?: SessionDetailDto
  /** The sessions list. Defaults to the graph scene's. */
  readonly items?: readonly SessionListItemDto[]
  /** What `getSession` answers for a session other than the lead, by session id. Others answer with an empty detail. */
  readonly sessions?: Readonly<
    Record<string, IpcResult<SessionDetailDto> | Promise<IpcResult<SessionDetailDto>>>
  >
  /** The query client the view uses, for a test that seeds its cache first. A fresh one when omitted. */
  readonly client?: QueryClient
  /** When the lead's detail was cached, in epoch milliseconds. Defaults to now. */
  readonly detailUpdatedAt?: number
  /** What `getWorktreePatch` answers, by agent id. Others answer with a patch of no files. */
  readonly patches?: Readonly<
    Record<string, IpcResult<WorktreePatchDto> | Promise<IpcResult<WorktreePatchDto>>>
  >
  /** What `getWorktreeDiffs` answers, by session id. Others answer with no worktree agents. */
  readonly diffs?: Readonly<
    Record<string, IpcResult<WorktreeDiffsDto> | Promise<IpcResult<WorktreeDiffsDto>>>
  >
}

/**
 * Renders the session's graph and inspector for the scene's lead, with the
 * lead's detail already cached as the view has it, and the sessions and
 * worktree diffs it loads stubbed.
 *
 * @param options - What to show instead of the defaults.
 * @returns The render result, the stubbed API, and the query client.
 */
export function renderInspectorScene(
  options: InspectorSceneOptions = {}
): ReturnType<typeof render> & { readonly api: TestBeekeeperApi; readonly client: QueryClient } {
  const {
    detail = LEAD_DETAIL,
    items = SCENE_ITEMS,
    sessions = {},
    diffs = {},
    client = createTestQueryClient(),
    detailUpdatedAt = Date.now(),
    patches = {}
  } = options
  const api = installBeekeeperApi({
    getSession: (_folder, sessionId) =>
      Promise.resolve(
        sessionId === SCENE_SESSION.sessionId
          ? { ok: true, value: detail }
          : (sessions[sessionId] ?? { ok: true, value: testDetail() })
      ),
    getWorktreeDiffs: (_folder, sessionId) =>
      Promise.resolve(
        diffs[sessionId] ?? { ok: true, value: { git: 'ok', agents: [], sharedWorktree: null } }
      ),
    getWorktreePatch: (_folder, _sessionId, agentId) =>
      Promise.resolve(
        patches[agentId] ?? {
          ok: true,
          value: { kind: 'ready', uncommitted: 'included', files: [], truncatedTotal: false }
        }
      )
  })
  // The view only shows the inspector once the lead's detail has loaded, so it is already cached.
  client.setQueryData(['session', SCENE_SESSION.projectDirName, SCENE_SESSION.sessionId], detail, {
    updatedAt: detailUpdatedAt
  })
  const rendered = render(
    createElement(SessionDetailBody, {
      detail,
      sessionRef: SCENE_SESSION,
      row: testRow(1, items)
    }),
    { wrapper: createQueryWrapper(client) }
  )
  return Object.assign(rendered, { api, client })
}

/** Queries inside the inspector region. */
export function inspector(): ReturnType<typeof within> {
  return within(screen.getByRole('region', { name: 'Agent inspector' }))
}
