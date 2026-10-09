import { createOtelReceiver, OTEL_RECEIVER_PORT } from './createOtelReceiver'
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
  /** The port to bind. Defaults to {@link OTEL_RECEIVER_PORT}; tests pass 0 for a free one. */
  readonly port?: number
}

/**
 * Builds the telemetry receiver, off until the saved setting or a person turns
 * it on, and the store it reports into.
 *
 * @param options - The settings file and, optionally, the port.
 * @returns The controller and the store the receiver writes to.
 */
export function createOtelRuntime(options: OtelRuntimeOptions): OtelRuntime {
  const { settingsPath, port = OTEL_RECEIVER_PORT } = options
  const costs = createReportedCostStore()
  const receiver = createOtelReceiver({ costs, port })
  return {
    receiver: createOtelReceiverController({
      settings: createOtelSettingsStore(settingsPath),
      receiver,
      port
    }),
    costs
  }
}
