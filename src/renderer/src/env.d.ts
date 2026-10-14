/// <reference types="vite/client" />

/**
 * A hash of the IPC contract in `src/shared/ipc/`, defined at build time. The
 * persisted query cache is discarded when it changes, so a cache written under
 * an older contract is never read as the current shape.
 */
declare const __IPC_CONTRACT_HASH__: string

/** The Window Controls Overlay API, which Electron exposes when a window sets `titleBarOverlay`. */
interface WindowControlsOverlay extends EventTarget {
  /** Whether the window's controls float over the page. */
  readonly visible: boolean
}

interface Navigator {
  /** Present only in a window with a controls overlay. */
  readonly windowControlsOverlay?: WindowControlsOverlay
}
