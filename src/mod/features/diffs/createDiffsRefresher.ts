import type { IpcResult } from '../../../shared/ipc/ipcResult'
import { getSessionRequestSchema } from '../../../shared/ipc/requestSchemas'
import type { WorktreeDiffsDto } from '../../../shared/ipc/worktreeDiffDto'
import { selectedNode, type PaneSelection } from '../pane/selectedNode'
import type { PaneView } from '../pane/paneView'
import { LIST_TICK_MS } from '../pane/paneScheduler'
import { contentKey } from '../shared/contentKey'
import type { PaneErrorCode } from '../shared/paneErrorCode'
import type { PaneServices } from '../shared/paneServices'
import type { PaneDiffs } from './paneDiffs'
import { toPaneDiffs } from './toPaneDiffs'

/** What the refresher needs from the engine, as closures so it runs without `$`. */
export interface DiffsRefresherDeps {
  /** Stores the diff for the pane to draw: `$.state.set`. Resolves whether the engine stored it. */
  writeDiffs(diffs: PaneDiffs): Promise<boolean>
  /** Receives a code-only line for a failure the refresher survives. */
  log(code: string): void
}

/** What {@link DiffsRefresher.refresh} works from. */
export interface DiffsRefreshInput {
  /** The service calls. */
  readonly services: PaneServices
  /** The view being shown. */
  readonly view: PaneView
  /** The stored selection, or `null` for none. */
  readonly selected: PaneSelection | null
  /** The time, in milliseconds since the epoch. */
  readonly nowMs: number
}

/** Loads the selected agent's worktree diff into state. */
export interface DiffsRefresher {
  /**
   * Stores the selected agent's worktree diff, or a `none` diff when the selected node has none. Keeps
   * the last session's diffs and runs git (through the service) again only when the agent belongs to
   * another session, {@link LIST_TICK_MS} has passed, or the agent is missing from them after the view
   * changed. Never rejects.
   */
  refresh(input: DiffsRefreshInput): Promise<void>
  /** Forgets what was last stored, so the next refresh writes even a diff that matches: call it when the stored diff may be gone. */
  forgetStored(): void
}

/** A fetch's outcome, kept so a failure is not retried inside the same window. */
type Fetched =
  | { readonly ok: true; readonly value: WorktreeDiffsDto }
  | { readonly ok: false; readonly code: PaneErrorCode }

/** The diffs of one session, and when they were fetched. */
interface CachedFetch {
  readonly owner: string
  /** The shown view's content when fetched, so a changed view (a newly spawned agent) can be told. */
  readonly viewKey: string
  readonly fetchedAtMs: number
  readonly fetched: Fetched
}

/**
 * Whether a fetch must be redone: none for this session, older than a window, or one that has no
 * entry for the agent although the view has changed since (the agent was just spawned).
 */
function isStale(input: {
  readonly cache: CachedFetch
  readonly owner: string
  readonly viewKey: string
  readonly agentId: string
  readonly nowMs: number
}): boolean {
  const { cache, owner, viewKey, agentId, nowMs } = input
  if (cache.owner !== owner || nowMs - cache.fetchedAtMs >= LIST_TICK_MS) return true
  const { fetched } = cache
  const isMissing =
    fetched.ok &&
    fetched.value.git === 'ok' &&
    !fetched.value.agents.some((agent) => agent.agentId === agentId)
  return isMissing && cache.viewKey !== viewKey
}

/**
 * Builds the refresher for the selected agent's worktree diff. It holds the last fetch and the
 * last stored value, so build one per loaded copy of the mod.
 *
 * @param deps - The engine closures it works through.
 * @returns The refresher.
 */
export function createDiffsRefresher(deps: DiffsRefresherDeps): DiffsRefresher {
  let lastKey: string | null = null
  let stored: { readonly sessionId: string; readonly key: string } | null = null
  let cache: CachedFetch | null = null

  async function store(diffs: PaneDiffs): Promise<void> {
    const key = contentKey(diffs)
    if (key === lastKey) return
    try {
      if (!(await deps.writeDiffs(diffs))) return
    } catch {
      deps.log('pane-diffs-write-failed')
      return
    }
    lastKey = key
    stored = { sessionId: diffs.sessionId, key: diffs.key }
  }

  async function fetchDiffs(
    services: PaneServices,
    request: Parameters<PaneServices['getWorktreeDiffs']>[0]
  ): Promise<Fetched> {
    let result: IpcResult<WorktreeDiffsDto>
    try {
      result = await services.getWorktreeDiffs(request)
    } catch {
      deps.log('pane-diffs-failed')
      return { ok: false, code: 'internal' }
    }
    return result.ok ? result : { ok: false, code: result.error.code }
  }

  async function refresh(input: DiffsRefreshInput): Promise<void> {
    const { services, view, selected, nowMs } = input
    const node = view.status === 'ready' ? selectedNode(view, selected) : null
    const worktree = node?.worktree ?? null
    const ids = { sessionId: view.sessionId, key: node?.key ?? '' }
    const withStatus = (
      status: PaneDiffs['status'],
      errorCode: PaneErrorCode | null
    ): PaneDiffs => ({
      ...ids,
      status,
      errorCode,
      git: null,
      result: null,
      refreshedAtMs: nowMs
    })
    if (node === null || worktree === null) return store(withStatus('none', null))
    const request = getSessionRequestSchema.safeParse({
      projectDirName: worktree.projectDirName,
      sessionId: worktree.sessionId
    })
    if (!request.success) return store(withStatus('error', 'invalid-request'))

    const owner = `${worktree.projectDirName}/${worktree.sessionId}`
    const viewKey = contentKey(view)
    let current = cache
    if (
      current === null ||
      isStale({ cache: current, owner, viewKey, agentId: worktree.agentId, nowMs })
    ) {
      if (stored?.sessionId !== ids.sessionId || stored.key !== ids.key) {
        await store(withStatus('loading', null))
      }
      current = {
        owner,
        viewKey,
        fetchedAtMs: nowMs,
        fetched: await fetchDiffs(services, request.data)
      }
      cache = current
    }
    const { fetched } = current
    await store(
      fetched.ok
        ? toPaneDiffs({ ...ids, agentId: worktree.agentId, dto: fetched.value, nowMs })
        : withStatus('error', fetched.code)
    )
  }

  return {
    refresh,
    forgetStored: () => {
      lastKey = null
      stored = null
    }
  }
}
