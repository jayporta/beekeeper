import { getWorktreePatchRequestSchema } from '../../../shared/ipc/requestSchemas'
import type { PaneView } from '../pane/paneView'
import { selectedNode, type PaneSelection } from '../pane/selectedNode'
import type { PaneErrorCode } from '../shared/paneErrorCode'
import type { PaneServices } from '../shared/paneServices'
import { emptyPanePatch, type PanePatch } from './panePatch'
import { toPanePatch } from './toPanePatch'

/** What the refresher needs from the engine, as closures so it runs without `$`. */
export interface PatchRefresherDeps {
  /** The patch in state, or `undefined` before any press: `$.state.get`. */
  readPatch(): Promise<PanePatch | undefined>
  /** Stores the patch for the pane to draw: `$.state.set`. Resolves whether the engine stored it. */
  writePatch(patch: PanePatch): Promise<boolean>
  /** Receives a code-only line for a failure the refresher survives. */
  log(code: string): void
}

/** What {@link PatchRefresher.refresh} works from. */
export interface PatchRefreshInput {
  /** The service calls. */
  readonly services: PaneServices
  /** The view being shown. */
  readonly view: PaneView
  /** The stored selection, or `null` for none. */
  readonly selected: PaneSelection | null
  /** The time, in milliseconds since the epoch. */
  readonly nowMs: number
}

/** Loads the patch a press asked for into state. */
export interface PatchRefresher {
  /**
   * Loads the patch when the stored one is `loading` and is of the selected node of the shown
   * view. A ready, hidden or other node's patch is left alone, so ticks and turns never reload
   * one. A result is stored only if the stored patch still asks for the same node. Never rejects.
   */
  refresh(input: PatchRefreshInput): Promise<void>
}

/**
 * Builds the refresher for the worktree patch.
 *
 * @param deps - The engine closures it works through.
 * @returns The refresher.
 */
export function createPatchRefresher(deps: PatchRefresherDeps): PatchRefresher {
  /** A fetched patch whose write failed, kept so the next refresh retries the write, not git. */
  let unwritten: PanePatch | null = null

  /** Stores the patch; whether the engine kept it. A failure is logged by code. */
  async function store(patch: PanePatch): Promise<boolean> {
    try {
      if (await deps.writePatch(patch)) return true
    } catch {
      // Logged below, like a refusal.
    }
    deps.log('pane-patch-write-failed')
    return false
  }

  /** Reads the stored patch; `undefined` when none is stored or it can't be read, which is logged. */
  async function read(): Promise<PanePatch | undefined> {
    try {
      return await deps.readPatch()
    } catch {
      deps.log('pane-patch-read-failed')
      return undefined
    }
  }

  async function fetchPatch(
    services: PaneServices,
    request: Parameters<PaneServices['getWorktreePatch']>[0],
    ids: { readonly sessionId: string; readonly key: string; readonly nowMs: number }
  ): Promise<PanePatch> {
    const failed = (errorCode: PaneErrorCode): PanePatch =>
      emptyPanePatch({ ...ids, status: 'error', errorCode })
    try {
      const result = await services.getWorktreePatch(request)
      return result.ok ? toPanePatch({ ...ids, dto: result.value }) : failed(result.error.code)
    } catch {
      deps.log('pane-patch-failed')
      return failed('internal')
    }
  }

  async function refresh(input: PatchRefreshInput): Promise<void> {
    const { services, view, selected, nowMs } = input
    const asked = await read()
    if (asked?.status !== 'loading' || asked.sessionId !== view.sessionId) return
    const node = view.status === 'ready' ? selectedNode(view, selected) : null
    const worktree = node?.worktree ?? null
    if (node === null || worktree === null || node.key !== asked.key) return
    const ids = { sessionId: asked.sessionId, key: asked.key, nowMs }
    if (unwritten?.sessionId === asked.sessionId && unwritten.key === asked.key) {
      if (await store(unwritten)) unwritten = null
      return
    }
    unwritten = null
    const request = getWorktreePatchRequestSchema.safeParse({
      projectDirName: worktree.projectDirName,
      sessionId: worktree.sessionId,
      agentId: worktree.agentId
    })
    if (!request.success) {
      await store(emptyPanePatch({ ...ids, status: 'error', errorCode: 'invalid-request' }))
      return
    }

    const next = await fetchPatch(services, request.data, ids)
    const now = await read()
    const isStillAsked =
      now?.status === 'loading' && now.sessionId === asked.sessionId && now.key === asked.key
    if (isStillAsked && !(await store(next))) unwritten = next
  }

  return { refresh }
}
