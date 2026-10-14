import type { ProjectDto } from '../../../shared/ipc/projectDto'
import { contentKey } from '../shared/contentKey'
import type { PaneServices } from '../shared/paneServices'
import { startErrorCode } from '../shared/startErrorCode'
import type { StartOutcome } from '../start/startMod'
import type { BrowseProject, BrowseView } from './browseView'
import { BROWSE_WORDS } from './browseWords'
import { emptyBrowseView } from './emptyBrowseView'
import { browseProjects } from './toBrowseView'
import { refreshBrowse } from './refreshBrowse'

/** What {@link createBrowseRefresher} works through. */
export interface BrowseRefresherDeps {
  /** Stores the Browse view for the pane to draw. Resolves whether the engine stored it. */
  readonly writeBrowse: (view: BrowseView) => Promise<boolean>
  /** Receives a code-only line for a failure the refresher survives. */
  readonly log: (line: string) => void
  /** The open id of the nav now stored, or `undefined` when none is or Browse isn't showing. */
  readonly readOpenId: () => Promise<number | undefined>
  /** The services for a projects folder. */
  readonly servicesFor: (projectsRoot: string) => PaneServices
}

/** What one Browse refresh needs to know. */
export interface BrowseRefreshRequest {
  /** The project the nav names, or `null` for none. */
  readonly projectDirName: string | null
  /** Whether Browse was just opened, from another screen. */
  readonly opened: boolean
  /** The open id of the nav this refresh was asked for, or `undefined` when it has none. A view from a refresh whose id is no longer the stored nav's is dropped. */
  readonly openId: number | undefined
  /** What starting the mod came to. */
  readonly outcome: StartOutcome
  /** The time, in milliseconds since the epoch. */
  readonly nowMs: number
  /** The engine's own session's folder, or `null` when its transcript isn't there yet. Asked for only when it is needed. */
  readonly currentFolder: () => Promise<string | null>
}

/** Builds and stores the Browse screen. */
export interface BrowseRefresher {
  /** Builds the Browse view and stores it, as far as it changed. Never rejects. */
  refresh(request: BrowseRefreshRequest): Promise<void>
  /** Stores an error view for a refresh that could not run, so Browse does not stay on loading. Never rejects. */
  fail(projectDirName: string | null, openId: number | undefined): Promise<void>
  /** Forgets what was stored, so the next refresh stores its view even if it matches. */
  forgetStored(): void
  /** Whether a view is stored since the last time stored views were forgotten. */
  isStored(): boolean
}

/**
 * Builds the Browse refresher: it keeps the projects last listed and the project last shown, so a
 * tick re-lists only that project's sessions, and the last stored view's key, so a refresh that
 * found nothing new stores nothing. Opening Browse forgets the project shown, so it opens on the
 * current session's folder, and lists the projects again.
 *
 * @param deps - The store, the log and the services.
 * @returns The refresher.
 */
export function createBrowseRefresher(deps: BrowseRefresherDeps): BrowseRefresher {
  let projects: readonly ProjectDto[] | null = null
  let shown: string | null = null
  let lastKey: string | null = null

  async function write(view: BrowseView, openId: number | undefined): Promise<boolean> {
    const key = contentKey(view)
    if (key === lastKey) return true
    try {
      // A refresh that began before Browse was reopened must not land as the new Browse's view.
      if ((await deps.readOpenId()) !== openId) return false
      if (!(await deps.writeBrowse(view))) return false
    } catch {
      deps.log('pane-write-failed')
      return false
    }
    lastKey = key
    return true
  }

  /** The picker options for the projects held, so an error screen can still pick another project. */
  const heldProjects = (): readonly BrowseProject[] =>
    projects === null ? [] : browseProjects(projects)

  async function fail(projectDirName: string | null, openId: number | undefined): Promise<void> {
    await write(
      emptyBrowseView({
        status: 'error',
        errorCode: 'internal',
        projects: heldProjects(),
        projectDirName,
        refreshedAtMs: 0
      }),
      openId
    )
  }

  async function build(request: BrowseRefreshRequest): Promise<void> {
    const { outcome, nowMs } = request
    if (outcome.kind !== 'ready') {
      await write(
        emptyBrowseView({
          status: 'error',
          errorCode: startErrorCode(outcome),
          projects: heldProjects(),
          projectDirName: request.projectDirName ?? shown,
          refreshedAtMs: nowMs
        }),
        request.openId
      )
      return
    }
    if (request.opened) shown = null
    const picked = request.projectDirName ?? shown
    const result = await refreshBrowse(deps.servicesFor(outcome.projectsRoot), {
      projectDirName: picked,
      currentFolder: picked === null ? await request.currentFolder() : null,
      withProjects: request.opened,
      lastProjects: projects,
      nowMs,
      words: BROWSE_WORDS,
      write: (view) => write(view, request.openId)
    })
    projects = result.projects
    shown = result.projectDirName
  }

  async function refresh(request: BrowseRefreshRequest): Promise<void> {
    try {
      await build(request)
    } catch {
      await fail(request.projectDirName ?? shown, request.openId)
    }
  }

  return { refresh, fail, forgetStored: () => (lastKey = null), isStored: () => lastKey !== null }
}
