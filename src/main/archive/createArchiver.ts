import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import { ARCHIVE_PASS_DELAY_MS, ARCHIVE_PASS_INTERVAL_MS } from './archiveConstants'
import type { PendingDetail } from './archiveStoreTypes'
import { describeArchiveError } from './describeArchiveError'
import { isDetailDue } from './isDetailDue'
import { lastActivityMs } from './lastActivityMs'

/** A project's sessions, discovered once so each pending detail needs no further lookup. */
export interface ArchivableProject {
  /** Whether the project still has a readable transcript for the session. */
  readonly has: (sessionId: string) => boolean
  /** Scans one of the project's sessions, which archives its detail. */
  readonly archiveDetail: (sessionId: string) => Promise<void>
}

/** What the archiver reads and does, injected so tests stay pure. */
export interface ArchiverOptions {
  /** Lists the project folder names. */
  readonly listProjects: () => Promise<readonly string[]>
  /** Whether a project holds a session that is new or differs from the archive, judged without scanning transcripts. */
  readonly changedSessions: (dirName: string) => Promise<boolean>
  /** Lists a project's sessions, which archives their list items. */
  readonly listSessions: (dirName: string) => Promise<void>
  /** The sessions whose detail could still be archived. */
  readonly pendingDetails: () => readonly PendingDetail[]
  /** Discovers a project's sessions, or returns `undefined` when the project is gone. */
  readonly openProject: (dirName: string) => Promise<ArchivableProject | undefined>
  /** Stops retrying a pending session whose transcript is gone. */
  readonly skipDetail: (ref: SessionRefDto) => void
  /** The current time in epoch milliseconds. */
  readonly now: () => number
  /** Receives each one-line failure log. Defaults to `console.warn`. */
  readonly log?: (line: string) => void
}

/** Archives sessions in the background. */
export interface Archiver {
  /** Schedules the first pass after {@link ARCHIVE_PASS_DELAY_MS}, then a pass every {@link ARCHIVE_PASS_INTERVAL_MS} after each one ends. Does nothing when already started or stopped. */
  start(): void
  /** Cancels the schedule and ends a running pass before its next step. */
  stop(): void
  /**
   * Runs one pass now, or joins the pass already running, so passes never overlap.
   *
   * @returns A promise that settles when the pass ends. It never rejects.
   */
  runPass(): Promise<void>
}

/**
 * Creates the background archiver. A pass lists each project whose sessions
 * changed, so their list items are archived, then archives the detail of every
 * pending session that has been quiet for the waiting period. Each project's
 * sessions are discovered once, however many details it archives. A pass takes
 * one step at a time, so it competes politely with the UI for reads, and one
 * failing project or session never ends it.
 *
 * @param options - What the archiver reads and does.
 * @returns The archiver, not yet started.
 */
export function createArchiver(options: ArchiverOptions): Archiver {
  const { log = console.warn } = options
  let started = false
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined

  async function listChangedProject(dirName: string): Promise<void> {
    try {
      if (await options.changedSessions(dirName)) await options.listSessions(dirName)
    } catch (error) {
      log(`Beekeeper archive pass skipped a project (${describeArchiveError(error)}).`)
    }
  }

  async function archiveProjectDetails(
    dirName: string,
    due: readonly SessionRefDto[]
  ): Promise<void> {
    let project: ArchivableProject | undefined
    try {
      project = await options.openProject(dirName)
    } catch (error) {
      log(`Beekeeper archive pass skipped a project (${describeArchiveError(error)}).`)
      return
    }
    if (project === undefined) return
    for (const ref of due) {
      if (stopped) return
      if (!project.has(ref.sessionId)) {
        options.skipDetail(ref)
        continue
      }
      try {
        await project.archiveDetail(ref.sessionId)
      } catch (error) {
        log(`Beekeeper archive pass skipped a session detail (${describeArchiveError(error)}).`)
      }
    }
  }

  /** The refs of pending sessions quiet for the waiting period, by project folder. */
  function dueByProject(projects: readonly string[]): ReadonlyMap<string, SessionRefDto[]> {
    const listed = new Set(projects)
    const due = new Map<string, SessionRefDto[]>()
    for (const { ref, source, activityLatestMs } of options.pendingDetails()) {
      const last = lastActivityMs({ activityLatestMs, modifiedMs: source.mtimeMs })
      if (!listed.has(ref.projectDirName) || !isDetailDue(last, options.now())) continue
      const refs = due.get(ref.projectDirName)
      if (refs === undefined) due.set(ref.projectDirName, [ref])
      else refs.push(ref)
    }
    return due
  }

  async function pass(): Promise<void> {
    let projects: readonly string[]
    try {
      projects = await options.listProjects()
    } catch (error) {
      log(`Beekeeper archive pass failed to list projects (${describeArchiveError(error)}).`)
      return
    }
    for (const dirName of projects) {
      if (stopped) return
      await listChangedProject(dirName)
    }
    const due = dueByProject(projects)
    for (const dirName of projects) {
      const refs = due.get(dirName)
      if (stopped) return
      if (refs !== undefined) await archiveProjectDetails(dirName, refs)
    }
  }

  function runPass(): Promise<void> {
    running ??= pass()
      .catch((error: unknown) => {
        log(`Beekeeper archive pass failed (${describeArchiveError(error)}).`)
      })
      .finally(() => {
        running = undefined
      })
    return running
  }

  function schedule(delayMs: number): void {
    timer = setTimeout(() => {
      void runPass().then(() => {
        if (!stopped) schedule(ARCHIVE_PASS_INTERVAL_MS)
      })
    }, delayMs)
  }

  return {
    start() {
      if (started || stopped) return
      started = true
      schedule(ARCHIVE_PASS_DELAY_MS)
    },
    stop() {
      stopped = true
      clearTimeout(timer)
    },
    runPass
  }
}
