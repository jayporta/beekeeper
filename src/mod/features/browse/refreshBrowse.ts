import type { IpcErrorCode } from '../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../shared/ipc/projectDto'
import { listSessionsRequestSchema } from '../../../shared/ipc/requestSchemas'
import { pickProject } from '../../../shared/projects/pickProject'
import { groupSessionRows } from '../../../shared/sessions/groupSessionRows'
import type { PaneServices } from '../shared/paneServices'
import type { PaneErrorCode } from '../shared/paneErrorCode'
import type { BrowseView } from './browseView'
import { emptyBrowseView } from './emptyBrowseView'
import type { BrowseWords } from './browseWords'
import { browseProjects, browseRows } from './toBrowseView'

/** What {@link refreshBrowse} needs. */
export interface RefreshBrowseInput {
  /** The picked project's folder, or `null` for none yet. */
  readonly projectDirName: string | null
  /** The engine's own session's folder, preferred when no project is picked, or `null` when it isn't known. */
  readonly currentFolder: string | null
  /** Whether to list the projects again after the sessions. */
  readonly withProjects: boolean
  /** The projects the last list returned, or `null` when none has. */
  readonly lastProjects: readonly ProjectDto[] | null
  /** The time to stamp the views with, in milliseconds since the epoch. */
  readonly nowMs: number
  /** The words for naming sessions and counting agents. */
  readonly words: BrowseWords
  /** Stores a view for the screen to draw. May throw or resolve `false`; that never stops the refresh. */
  readonly write: (view: BrowseView) => Promise<boolean>
}

/** What a refresh found out, to keep for the next one. */
export interface RefreshedBrowse {
  /** The projects, fresh when listed, otherwise the ones passed in. */
  readonly projects: readonly ProjectDto[] | null
  /** The project the screen shows, or `null` when there are no projects. */
  readonly projectDirName: string | null
}

type Services = Pick<PaneServices, 'listSessions' | 'listProjects'>

/** Stores a view; a failure to store is not the refresh's to handle. */
async function store(input: RefreshBrowseInput, view: BrowseView): Promise<void> {
  try {
    await input.write(view)
  } catch {
    // The caller's write logs its own failures with a code.
  }
}

async function build(services: Services, input: RefreshBrowseInput): Promise<RefreshedBrowse> {
  const { words } = input
  const fail = async (
    code: IpcErrorCode | PaneErrorCode,
    shown: Pick<BrowseView, 'projects' | 'projectDirName'>
  ): Promise<void> =>
    store(
      input,
      emptyBrowseView({ refreshedAtMs: input.nowMs, status: 'error', errorCode: code, ...shown })
    )

  let projects = input.lastProjects
  let projectDirName = input.projectDirName
  let projectsFresh = false

  if (projectDirName === null) {
    if (projects === null || projects.length === 0) {
      const listed = await services.listProjects()
      if (!listed.ok) {
        await fail(listed.error.code, { projects: [], projectDirName: null })
        return { projects: null, projectDirName: null }
      }
      projects = listed.value
      projectsFresh = true
    }
    projectDirName = pickProject(projects, input.currentFolder)
    if (projectDirName === null) {
      await store(input, emptyBrowseView({ refreshedAtMs: input.nowMs, status: 'ready' }))
      return { projects, projectDirName: null }
    }
  }

  const shown = (): Pick<BrowseView, 'projects' | 'projectDirName'> => ({
    projects: projects === null ? [] : browseProjects(projects),
    projectDirName
  })
  const request = listSessionsRequestSchema.safeParse({ projectDirName })
  if (!request.success) {
    await fail('invalid-request', shown())
    return { projects, projectDirName }
  }
  const listed = await services.listSessions(request.data)
  if (!listed.ok) {
    await fail(listed.error.code, shown())
    return { projects, projectDirName }
  }
  const { rows, hiddenCount } = browseRows(
    groupSessionRows(listed.value, words.label),
    words.agentCount
  )
  await store(
    input,
    emptyBrowseView({ refreshedAtMs: input.nowMs, status: 'ready', ...shown(), rows, hiddenCount })
  )

  if ((input.withProjects || projects === null) && !projectsFresh) {
    const relisted = await services.listProjects()
    // The sessions and the projects already held stay on screen: a failed relist loses nothing.
    if (!relisted.ok) return { projects, projectDirName }
    projects = relisted.value
    await store(
      input,
      emptyBrowseView({
        refreshedAtMs: input.nowMs,
        status: 'ready',
        ...shown(),
        rows,
        hiddenCount
      })
    )
  }
  return { projects, projectDirName }
}

/**
 * Builds the Browse screen's view and stores it: the picked project's
 * sessions first, so they show at once, then the projects when asked. With no
 * project picked it takes the current session's folder when it is listed,
 * else the first parent project. It never rejects: a failure becomes an
 * `error` view carrying a code only.
 *
 * @param services - The list calls.
 * @param input - What is picked, what is known, the time, the words and where to store.
 * @returns The projects and the project shown, to keep for the next refresh.
 */
export async function refreshBrowse(
  services: Services,
  input: RefreshBrowseInput
): Promise<RefreshedBrowse> {
  try {
    return await build(services, input)
  } catch {
    await store(
      input,
      emptyBrowseView({
        refreshedAtMs: input.nowMs,
        status: 'error',
        errorCode: 'internal',
        projectDirName: input.projectDirName
      })
    )
    return { projects: input.lastProjects, projectDirName: input.projectDirName }
  }
}
