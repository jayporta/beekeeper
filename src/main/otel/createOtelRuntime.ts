import { createOtelReceiver } from './createOtelReceiver'
import {
  createOtelReceiverController,
  type OtelReceiverController
} from './createOtelReceiverController'
import { createReportedCostStore, type ReportedCostStore } from './createReportedCostStore'
import { createOtelSettingsStore } from './otelSettings'

/** The telemetry receiver's parts as the IPC handlers and the app's lifecycle use them. */
export interface OtelRuntime {
  /** The on/off choice and the server behind it. */
  readonly receiver: OtelReceiverController
  /** What the receiver has heard from Claude Code, which the handlers read. */
  readonly costs: ReportedCostStore
}

/** Options for {@link createOtelRuntime}. */
export interface OtelRuntimeOptions {
  /** The settings file, such as `otel-receiver.json` in the app's data folder. */
  readonly settingsPath: string
  /** Picks the port to try each time the receiver is turned on. Defaults to a random port from 20000 to 29999; tests return 0 for a free one. */
  readonly pickPort?: () => number
  /** Called when the listening receiver fails after it started, so open windows can read its state again. */
  readonly onReceiverFailure?: () => void
}

/**
 * Builds the telemetry receiver, off until the saved setting or a person turns
 * it on, and the store it reports into.
 *
 * @param options - The settings file and, optionally, the port picker and the failure callback.
 * @returns The controller and the store the receiver writes to.
 */
export function createOtelRuntime(options: OtelRuntimeOptions): OtelRuntime {
  const { settingsPath, pickPort, onReceiverFailure } = options
  const costs = createReportedCostStore()
  const receiver = createOtelReceiver({ costs, onFailure: onReceiverFailure })
  return {
    receiver: createOtelReceiverController({
      settings: createOtelSettingsStore(settingsPath),
      receiver,
      costs,
      pickPort
    }),
    costs
  }
}
