import type { BrowserWindow } from 'electron'
import { errorCode } from '../../core/shared/errorCode'
import { IPC_EVENTS } from '../../shared/ipc/channels'
import { describeError } from '../describeError'
import { createChangeBatcher, type ChangeBatcherOptions } from './changeBatcher'
import { changedFolder } from './changedFolder'
import { sendLiveEvent } from './sendLiveEvent'

/** How long to wait before trying to watch a missing projects folder again. */
export const ROOT_RETRY_INTERVAL_MS = 30_000

/** The parts of an `fs.FSWatcher` the projects watcher uses. */
export interface WatcherLike {
  /** Subscribes to watcher failures. */
  on(event: 'error', listener: (error: unknown) => void): unknown
  /** Stops watching. */
  close(): void
}

/** What {@link createProjectsWatcher} needs from its caller. */
export interface ProjectsWatcherOptions {
  /** The `~/.claude/projects` directory. */
  readonly root: string
  /** Starts a recursive watch, as `fs.watch` does. It may throw. */
  readonly watch: (
    root: string,
    options: { recursive: true },
    listener: (event: string, filename: string | null) => void
  ) => WatcherLike
  /** Whether the root still exists, as `fs.existsSync` answers. */
  readonly exists: (root: string) => boolean
  /** The open windows, read each time something is sent. */
  readonly windows: () => readonly BrowserWindow[]
  /** The timer functions for batching and retrying. They default to `setTimeout` and `clearTimeout`. */
  readonly timers?: Pick<ChangeBatcherOptions, 'setTimer' | 'clearTimer'>
}

/** Watches the projects folder and tells the windows what changed. */
export interface ProjectsWatcher {
  /**
   * Starts telling a window when live updates are unavailable, now and after
   * every page load, because a reload loses what the page was told.
   * @param window - A newly created window.
   */
  notifyWindow(window: BrowserWindow): void
  /** Stops watching, cancels a pending retry, and drops any pending batch. */
  close(): void
}

type WatcherState = 'watching' | 'waiting' | 'unavailable' | 'closed'

const defaultTimers: Pick<ChangeBatcherOptions, 'setTimer' | 'clearTimer'> = {
  setTimer: (run, ms) => setTimeout(run, ms),
  clearTimer: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>)
  }
}

/**
 * Watches the projects root recursively and sends the windows batches of
 * changed project folders. It has three live states. While `watching`, events
 * are batched. When the root is missing at start or disappears, it is
 * `waiting`: it sends nothing and retries every {@link ROOT_RETRY_INTERVAL_MS}
 * (the first-run screen already explains a missing root), and a retry that
 * succeeds asks the windows to refresh everything. Any other failure makes it
 * `unavailable` for good and tells the windows once. It logs only the error
 * code, never a path.
 *
 * @param options - The root, the watch function and the windows.
 * @returns The watcher, already started.
 */
export function createProjectsWatcher(options: ProjectsWatcherOptions): ProjectsWatcher {
  const { root, watch, exists, windows } = options
  const { setTimer, clearTimer } = options.timers ?? defaultTimers
  const batcher = createChangeBatcher({
    send: (change) => {
      sendLiveEvent(windows(), { channel: IPC_EVENTS.filesChanged, payload: change })
    },
    setTimer,
    clearTimer
  })
  let state: WatcherState = 'waiting'
  let watcher: WatcherLike | null = null
  let retryTimer: unknown = null

  function stopWatching(): void {
    watcher?.close()
    watcher = null
  }

  function stopRetrying(): void {
    if (retryTimer !== null) clearTimer(retryTimer)
    retryTimer = null
  }

  function fail(error: unknown): void {
    if (state === 'unavailable' || state === 'closed') return
    stopWatching()
    stopRetrying()
    batcher.dispose()
    state = 'unavailable'
    console.warn(`Live updates stopped (${describeError(error)}).`)
    sendLiveEvent(windows(), { channel: IPC_EVENTS.liveUpdatesUnavailable })
  }

  function wait(): void {
    stopWatching()
    state = 'waiting'
    retryTimer = setTimer(retry, ROOT_RETRY_INTERVAL_MS)
  }

  function onEvent(_event: string, filename: string | null): void {
    if (state !== 'watching') return
    const change = changedFolder(filename)
    batcher.add(change)
    if (change.kind === 'unknown' && !exists(root)) wait()
  }

  function start(): void {
    try {
      watcher = watch(root, { recursive: true }, onEvent)
    } catch (error) {
      if (errorCode(error) === 'ENOENT') wait()
      else fail(error)
      return
    }
    watcher.on('error', fail)
    state = 'watching'
  }

  function retry(): void {
    retryTimer = null
    start()
    // Folders may have appeared while the root was missing.
    if (state === 'watching') batcher.add({ kind: 'unknown' })
  }

  start()

  return {
    notifyWindow(window) {
      window.webContents.on('did-finish-load', () => {
        if (state === 'unavailable')
          sendLiveEvent([window], { channel: IPC_EVENTS.liveUpdatesUnavailable })
      })
    },
    close() {
      if (state === 'closed') return
      state = 'closed'
      stopWatching()
      stopRetrying()
      batcher.dispose()
    }
  }
}
