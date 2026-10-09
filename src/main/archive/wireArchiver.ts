import type { Archiver } from './createArchiver'

/** The app events the archiver follows, so tests need no Electron. */
export interface ArchiverHost {
  /** Calls the listener once, when the first window has finished loading. */
  onFirstWindowLoaded(listener: () => void): void
  /** Calls the listener once, when the app is about to quit. */
  onWillQuit(listener: () => void): void
}

/** Options for {@link wireArchiver}. */
export interface WireArchiverOptions {
  /** The archiver to start and stop. */
  readonly archiver: Archiver
  /** Closes the archive after the archiver stops. */
  readonly close: () => void
  /** The app events to follow. */
  readonly host: ArchiverHost
}

/**
 * Starts the archiver once the first window has loaded, a turn of the event
 * loop later so the window's own first reads go first, and stops it and then
 * closes the archive when the app quits. A quit before the deferred start
 * leaves the archiver stopped.
 *
 * @param options - The archiver, how to close the archive, and the app events.
 */
export function wireArchiver(options: WireArchiverOptions): void {
  const { archiver, close, host } = options
  let quitting = false
  host.onFirstWindowLoaded(() => {
    setImmediate(() => {
      if (!quitting) archiver.start()
    })
  })
  host.onWillQuit(() => {
    quitting = true
    archiver.stop()
    close()
  })
}
