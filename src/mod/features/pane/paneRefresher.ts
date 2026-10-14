import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import { createBrowseRefresher } from '../browse/createBrowseRefresher'
import { startMod, type StartOutcome } from '../start/startMod'
import { createPaneServices } from './createPaneServices'
import { contentKey } from './contentKey'
import { emptyPaneView } from './emptyPaneView'
import { findSessionFolder } from './findSessionFolder'
import { hasTeam } from './hasTeam'
import { targetOf, type PaneNav } from './paneNav'
import type { PaneRefresher, PaneRefresherDeps } from './paneRefresherTypes'
import type { PaneView } from './paneView'
import { PLAIN_TICK_MS } from './paneScheduler'
import { refreshPane, type PaneServices } from './refreshPane'

export type { PaneHost, PaneRefresher, PaneRefresherDeps } from './paneRefresherTypes'
import { startErrorCode } from './startErrorCode'

/**
 * How long a session without a team goes between lists, a second under the plain tick so a tick
 * that lands a little early still lists. The list is where its total and
 * title come from, and listing sweeps the project's folders, so it is not repeated every refresh.
 */
const SOLO_LIST_INTERVAL_MS = PLAIN_TICK_MS - 1_000

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
  let lastNavKey: string | null = null
  let lastNavScreen: PaneNav['screen'] = 'current'
  let lastScreen: PaneNav['screen'] = 'current'
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

  const browse = createBrowseRefresher({
    writeBrowse: (view) => pane.writeBrowse(view),
    log,
    servicesFor
  })

  /** The engine's own session's folder, remembered per session id; `null` when its transcript isn't there yet. */
  async function folderOf(
    session: { readonly sessionId: string; readonly sessionRoot: string },
    projectsRoot: string
  ): Promise<string | null> {
    const known = folders.get(session.sessionId)
    if (known !== undefined) return known
    const found = await findSessionFolder(host, { projectsRoot, ...session })
    if (found !== null) folders.set(session.sessionId, found)
    return found
  }

  /** The stored nav; one that can't be read is the current screen. */
  async function readNav(): Promise<PaneNav | undefined> {
    try {
      return await pane.nav()
    } catch {
      return undefined
    }
  }

  /**
   * Remembers the nav and, when it changed, forgets what was stored and listed, so the new screen is
   * written and listed afresh. Call it only for a refresh that builds, so a tick that builds nothing
   * can't use up a change.
   *
   * @returns Whether the nav changed, and whether it changed to Browse from another screen.
   */
  function noteNav(nav: PaneNav | undefined): { changed: boolean; opened: boolean } {
    const key = JSON.stringify(nav ?? { screen: 'current' })
    const screen = nav?.screen ?? 'current'
    const previous = lastNavScreen
    lastNavScreen = screen
    if (key === lastNavKey) return { changed: false, opened: false }
    lastNavKey = key
    lastKey = null
    browse.forgetStored()
    lastList = null
    return { changed: true, opened: screen === 'browse' && previous !== 'browse' }
  }

  /** What every refresh starts from: the engine's session, its root, the time, and what starting the mod came to. */
  async function readSession(): Promise<{
    readonly sessionId: string
    readonly sessionRoot: string
    readonly nowMs: number
    readonly outcome: StartOutcome
  }> {
    const [sessionId, sessionRoot, nowMs] = await Promise.all([
      pane.sessionId(),
      pane.sessionRoot(),
      pane.now()
    ])
    return { sessionId, sessionRoot, nowMs, outcome: started ?? (await startNow(sessionRoot)) }
  }

  async function build(withList: boolean, nav: PaneNav | undefined): Promise<PaneView> {
    const { sessionId: currentId, sessionRoot, nowMs, outcome } = await readSession()
    const { ref: wanted, target } = targetOf(nav, { projectDirName: '', sessionId: currentId })
    const sessionId = wanted.sessionId
    if (outcome.kind !== 'ready') {
      const errorCode = startErrorCode(outcome)
      return emptyPaneView({ sessionId, target, status: 'error', errorCode, nowMs })
    }
    const folder =
      target === 'browsed'
        ? wanted.projectDirName
        : await folderOf({ sessionId, sessionRoot }, outcome.projectsRoot)
    if (folder === null)
      return emptyPaneView({ sessionId, target, status: 'waiting', errorCode: null, nowMs })
    const known = lastList?.folder === folder ? lastList.items : null
    const isSoloListDue = !hasTeam(lastView) && nowMs - lastListedAtMs >= SOLO_LIST_INTERVAL_MS
    const listing = withList || known === null || isSoloListDue
    const { view, items } = await refreshPane(servicesFor(outcome.projectsRoot), {
      ref: { projectDirName: folder, sessionId },
      target,
      withList: listing,
      lastItems: known,
      nowMs
    })
    if (listing) lastListedAtMs = nowMs
    if (items !== null) lastList = { folder, items }
    if (view.errorCode === 'not-found' && target === 'current') folders.delete(sessionId)
    return view
  }

  async function refresh(request: { readonly withList: boolean }): Promise<void> {
    const nav = await readNav()
    lastScreen = nav?.screen ?? 'current'
    if (nav?.screen === 'browse') {
      if (!request.withList) return
      const { opened } = noteNav(nav)
      try {
        const { sessionId, sessionRoot, nowMs, outcome } = await readSession()
        await browse.refresh({
          projectDirName: nav.projectDirName,
          opened,
          outcome,
          nowMs,
          currentFolder: () =>
            outcome.kind === 'ready'
              ? folderOf({ sessionId, sessionRoot }, outcome.projectsRoot)
              : Promise.resolve(null)
        })
      } catch {
        log('pane-browse-failed')
      }
      return
    }
    noteNav(nav)
    let view: PaneView
    try {
      view = await build(request.withList, nav)
    } catch {
      view = emptyPaneView({
        sessionId: '',
        target: 'current',
        status: 'error',
        errorCode: 'internal',
        nowMs: 0
      })
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
    browse.forgetStored()
  }

  return {
    start: startNow,
    refresh,
    forgetStored,
    wantsListTick: () => lastScreen === 'browse' || hasTeam(lastView)
  }
}
