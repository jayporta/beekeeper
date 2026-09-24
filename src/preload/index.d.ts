import type { BeekeeperApi } from '../shared/ipc/beekeeperApi'

declare global {
  interface Window {
    /** The main-process API the preload script exposes. */
    beekeeper: BeekeeperApi
  }
}
