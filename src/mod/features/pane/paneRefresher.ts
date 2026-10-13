import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import type { ModHost } from '../../modHost'
import { startMod, type StartOutcome } from '../start/startMod'
import { createPaneServices } from './createPaneServices'
import { emptyPaneView } from './emptyPaneView'
import { findSessionFolder } from './findSessionFolder'
import { hasTeam } from './hasTeam'
import type { PaneView } from './paneView'
import { refreshPane, type PaneServices } from './refreshPane'

/** The engine calls the pane's refresh makes, as closures so lib never sees `$`. */
export interface PaneHost {
  /** The current session's id: `$.session.id()`. */
  sessionId(): Promise<string>
  /** The current session's working directory: `$.session.root()`. */
  sessionRoot(): Promise<string>
  /** The time in milliseconds since the epoch: `$.clock.now()`. */
  now(): Promise<number>
  /** Stores the view for the pane to draw: `$.state.set`. */
  writeView(view: PaneView): Promise<void>
}

/** What {@link createPaneRefresher} works through. */
export interface PaneRefresherDeps {
  /** What the mod may ask of the engine. */
  readonly host: ModHost
  /** The pane's engine calls. */
  readonly pane: PaneHost
  /** Starts the mod; defaults to {@link startMod}. */
  readonly start?: (host: ModHost, session: { cwd: string }) => Promise<StartOutcome>
  /** Builds the services for a projects folder; defaults to {@link createPaneServices}. */
  readonly createServices?: (projectsRoot: string) => PaneServices
}

/** Refreshes the pane's view. */
export interface PaneRefresher {
  /** Starts the mod once it is ready, remembering the outcome, and returns it. */
  start(cwd: string): Promise<StartOutcome>
  /** Builds the current session's view and stores it. Never rejects. */
  refresh(request: { readonly withList: boolean }): Promise<void>
  /** Whether the last view shows a team, so the slow list tick is worth running. */
  wantsListTick(): boolean
}

/**
 * Builds the refresh the scheduler runs. It starts the mod when no
 * `session.start` ran in this copy, builds the services once per projects
 * folder, finds the session's folder (remembered per session id), and keeps
 * the last list so a refresh without the list reuses it.
 *
 * @param deps - The host, the pane's engine calls, and test seams.
 * @returns The refresher.
 */
export function createPaneRefresher(deps: PaneRefresherDeps): PaneRefresher {
  const { host, pane, start = startMod, createServices = createPaneServices } = deps
  let ready: Extract<StartOutcome, { kind: 'ready' }> | null = null
  let services: { readonly projectsRoot: string; readonly value: PaneServices } | null = null
  const folders = new Map<string, string>()
  let lastList: { readonly folder: string; readonly items: readonly SessionListItemDto[] } | null =
    null
  let lastView: PaneView | null = null

  async function startOnce(cwd: string): Promise<StartOutcome> {
    if (ready !== null) return ready
    const outcome = await start(host, { cwd })
    if (outcome.kind === 'ready') ready = outcome
    return outcome
  }

  function servicesFor(projectsRoot: string): PaneServices {
    if (services?.projectsRoot !== projectsRoot) {
      services = { projectsRoot, value: createServices(projectsRoot) }
    }
    return services.value
  }

  async function build(withList: boolean): Promise<PaneView | null> {
    const [sessionId, sessionRoot, nowMs] = await Promise.all([
      pane.sessionId(),
      pane.sessionRoot(),
      pane.now()
    ])
    const outcome = await startOnce(sessionRoot)
    if (outcome.kind !== 'ready') return null
    const folder =
      folders.get(sessionId) ??
      (await findSessionFolder(host, {
        projectsRoot: outcome.projectsRoot,
        sessionId,
        sessionRoot
      }))
    if (folder === null)
      return emptyPaneView({ sessionId, status: 'waiting', errorCode: null, nowMs })
    folders.set(sessionId, folder)
    const known = lastList?.folder === folder ? lastList.items : null
    const { view, items } = await refreshPane(servicesFor(outcome.projectsRoot), {
      ref: { projectDirName: folder, sessionId },
      withList: withList || known === null,
      lastItems: known,
      nowMs
    })
    if (items !== null) lastList = { folder, items }
    if (view.errorCode === 'not-found') folders.delete(sessionId)
    return view
  }

  async function refresh(request: { readonly withList: boolean }): Promise<void> {
    let view: PaneView | null
    try {
      view = await build(request.withList)
    } catch {
      view = emptyPaneView({ sessionId: '', status: 'error', errorCode: 'internal', nowMs: 0 })
    }
    if (view === null) return
    lastView = view
    await pane.writeView(view)
  }

  return { start: startOnce, refresh, wantsListTick: () => hasTeam(lastView) }
}
