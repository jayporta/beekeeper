import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import { ARCHIVE_PASS_DELAY_MS, ARCHIVE_PASS_INTERVAL_MS } from './archiveConstants'
import type { PendingDetail } from './createArchiveStore'
import { describeArchiveError } from './describeArchiveError'
import { isDetailDue } from './isDetailDue'
import { lastActivityMs } from './lastActivityMs'

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
  /** Scans one session, which archives its detail. */
  readonly archiveDetail: (ref: SessionRefDto) => Promise<void>
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
 * pending session that has been quiet for the waiting period. A pass takes
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

  async function archiveDetailOf(ref: SessionRefDto): Promise<void> {
    try {
      await options.archiveDetail(ref)
    } catch (error) {
      log(`Beekeeper archive pass skipped a session detail (${describeArchiveError(error)}).`)
    }
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
    const listed = new Set(projects)
    for (const { ref, source, activityLatestMs } of options.pendingDetails()) {
      if (stopped) return
      const last = lastActivityMs({ activityLatestMs, modifiedMs: source.mtimeMs })
      if (listed.has(ref.projectDirName) && isDetailDue(last, options.now())) {
        await archiveDetailOf(ref)
      }
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
