import type { ServiceDeps } from '../../service/serviceDeps'
import type { OtelRuntime } from '../otel/createOtelRuntime'

/** What the handlers need: the services' dependencies, plus the app's own. */
export interface IpcDeps extends ServiceDeps {
  /**
   * The opt-in telemetry receiver and what it has heard, or `null` when the
   * app didn't set one up. The app sets it in `index.ts`, so tests that don't
   * touch it get `null`.
   */
  readonly otel: OtelRuntime | null
  /**
   * Writes text to the system clipboard, or `null` when the app didn't set one
   * up. The app supplies Electron's `clipboard.writeText` in `index.ts`, so
   * tests that don't touch it get `null` and never reach the real clipboard.
   */
  readonly copyToClipboard: ((text: string) => void) | null
}
