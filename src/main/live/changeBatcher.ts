import { MAX_CHANGED_FOLDERS, type FilesChangedDto } from '../../shared/ipc/filesChangedDto'
import type { FolderChange } from './changedFolder'

/** How long a batch collects changes before it is sent, counted from its first change. */
export const LIVE_UPDATE_INTERVAL_MS = 2000

/** Collects watch events into batches, at most one per interval. */
export interface ChangeBatcher {
  /** Adds one change. The first change of a batch starts the interval timer. An ignored change is left out. */
  add(change: FolderChange): void
  /** Cancels a pending batch without sending it. */
  dispose(): void
}

/** What {@link createChangeBatcher} needs from its caller. */
export interface ChangeBatcherOptions {
  /** Receives each finished batch. */
  readonly send: (change: FilesChangedDto) => void
  /** Starts a timer that calls `run` once after `ms`, and returns a handle for `clearTimer`. */
  readonly setTimer: (run: () => void, ms: number) => unknown
  /** Cancels a timer started by `setTimer`. */
  readonly clearTimer: (handle: unknown) => void
}

/**
 * Batches folder changes so a burst of watch events becomes one message.
 * A batch becomes `all` when a change is unknown or it names more than
 * `MAX_CHANGED_FOLDERS` distinct folders. Folder names are then dropped.
 *
 * @param options - Where batches go and the timer functions to use.
 * @returns The batcher.
 */
export function createChangeBatcher(options: ChangeBatcherOptions): ChangeBatcher {
  const { send, setTimer, clearTimer } = options
  const dirNames = new Set<string>()
  let foldersChanged = false
  let all = false
  let timer: unknown = null

  function reset(): void {
    dirNames.clear()
    foldersChanged = false
    all = false
    timer = null
  }

  function flush(): void {
    const batch: FilesChangedDto = {
      dirNames: [...dirNames].sort(),
      foldersChanged,
      all
    }
    reset()
    send(batch)
  }

  return {
    add(change) {
      if (change.kind === 'ignored') return
      if (change.kind === 'unknown') {
        all = true
      } else {
        if (change.isFolderItself) foldersChanged = true
        if (!all) {
          dirNames.add(change.dirName)
          if (dirNames.size > MAX_CHANGED_FOLDERS) all = true
        }
      }
      if (all) dirNames.clear()
      timer ??= setTimer(flush, LIVE_UPDATE_INTERVAL_MS)
    },
    dispose() {
      if (timer !== null) clearTimer(timer)
      reset()
    }
  }
}
