import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import type { ModHost } from '../../modHost'
import { startMod, type StartOutcome } from '../start/startMod'
import { createPaneServices } from './createPaneServices'
import { emptyPaneView } from './emptyPaneView'
import { findSessionFolder } from './findSessionFolder'
import { hasTeam } from './hasTeam'
import type { PaneView } from './paneView'
import { PLAIN_TICK_MS } from './paneScheduler'
import { refreshPane, type PaneServices } from './refreshPane'

/**
 * How long a session without a team goes between lists, a second under the plain tick so a tick
 * that lands a little early still lists. The list is where its total and
 * title come from, and listing sweeps the project's folders, so it is not repeated every refresh.
 */
const SOLO_LIST_INTERVAL_MS = PLAIN_TICK_MS - 1_000

/** The engine calls the pane's refresh makes, as closures so lib never sees `$`. */
export interface PaneHost {
  /** The current session's id: `$.session.id()`. */
  sessionId(): Promise<string>
  /** The current session's working directory: `$.session.root()`. */
  sessionRoot(): Promise<string>
  /** The time in milliseconds since the epoch: `$.clock.now()`. */
  now(): Promise<number>
  /** Stores the view for the pane to draw: `$.state.set`. Resolves whether the engine stored it. */
  writeView(view: PaneView): Promise<boolean>
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
  /** Receives a code-only line for a failure the refresher survives; defaults to `console.error`. */
  readonly log?: (line: string) => void
}

/** Refreshes the pane's view. */
export interface PaneRefresher {
  /** Starts the mod unless it is already ready, remembering the outcome, and returns it. A later refresh reuses a failed outcome rather than probing again; this call retries a failed one, and joins a probe already in flight. */
  start(cwd: string): Promise<StartOutcome>
  /** Forgets what was last stored, so the next refresh writes its view even if it matches: call it when the stored view may be gone (after a `/clear`, or a render that found none). */
  forgetStored(): void
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
  const {
    host,
    pane,
    start = startMod,
    createServices = createPaneServices,
    log = console.error
  } = deps
  let started: StartOutcome | null = null
  let services: { readonly projectsRoot: string; readonly value: PaneServices } | null = null
  const folders = new Map<string, string>()
  let lastList: { readonly folder: string; readonly items: readonly SessionListItemDto[] } | null =
    null
  let lastView: PaneView | null = null
  let lastKey: string | null = null
  let lastListedAtMs = Number.NEGATIVE_INFINITY

  let probing: Promise<StartOutcome> | null = null

  /** Starts the mod. Overlapping calls share one probe, and a ready outcome is never replaced. */
  function startNow(cwd: string): Promise<StartOutcome> {
    if (started?.kind === 'ready') return Promise.resolve(started)
    probing ??= start(host, { cwd })
      .then((outcome) => {
        if (started?.kind !== 'ready') started = outcome
        return started ?? outcome
      })
      .finally(() => {
        probing = null
      })
    return probing
  }

  function servicesFor(projectsRoot: string): PaneServices {
    if (services?.projectsRoot !== projectsRoot) {
      services = { projectsRoot, value: createServices(projectsRoot) }
    }
    return services.value
  }

  async function build(withList: boolean): Promise<PaneView> {
    const [sessionId, sessionRoot, nowMs] = await Promise.all([
      pane.sessionId(),
      pane.sessionRoot(),
      pane.now()
    ])
    const outcome = started ?? (await startNow(sessionRoot))
    if (outcome.kind !== 'ready') {
      const errorCode = outcome.kind === 'too-old' ? 'too-old' : 'start-failed'
      return emptyPaneView({ sessionId, status: 'error', errorCode, nowMs })
    }
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
    const isSoloListDue = !hasTeam(lastView) && nowMs - lastListedAtMs >= SOLO_LIST_INTERVAL_MS
    const listing = withList || known === null || isSoloListDue
    const { view, items } = await refreshPane(servicesFor(outcome.projectsRoot), {
      ref: { projectDirName: folder, sessionId },
      withList: listing,
      lastItems: known,
      nowMs
    })
    if (listing) lastListedAtMs = nowMs
    if (items !== null) lastList = { folder, items }
    if (view.errorCode === 'not-found') folders.delete(sessionId)
    return view
  }

  /** The view without its time, so a refresh that found nothing new can be told from one that did. */
  const contentKey = (view: PaneView): string => JSON.stringify({ ...view, refreshedAtMs: 0 })

  async function refresh(request: { readonly withList: boolean }): Promise<void> {
    let view: PaneView
    try {
      view = await build(request.withList)
    } catch {
      view = emptyPaneView({ sessionId: '', status: 'error', errorCode: 'internal', nowMs: 0 })
    }
    const key = contentKey(view)
    if (key === lastKey) return
    try {
      if (!(await pane.writeView(view))) return
    } catch {
      log('pane-write-failed')
      return
    }
    lastView = view
    lastKey = key
  }

  const forgetStored = (): void => {
    lastKey = null
  }

  return { start: startNow, refresh, forgetStored, wantsListTick: () => hasTeam(lastView) }
}
