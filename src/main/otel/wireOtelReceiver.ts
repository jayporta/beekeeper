import { describeError } from '../describeError'
import { createOtelRuntime, type OtelRuntime } from './createOtelRuntime'

/** The app events the telemetry receiver follows, so tests need no Electron. */
export interface OtelReceiverHost {
  /** Calls the listener when the app is about to quit. */
  onWillQuit(listener: () => void): void
  /** Tells open windows the receiver's state changed without a request from them, so they read it again. */
  notifyReceiverChanged(): void
}

/** Options for {@link wireOtelReceiver}. */
export interface WireOtelReceiverOptions {
  /** The settings file, such as `otel-receiver.json` in the app's data folder. */
  readonly settingsPath: string
  /** The app events to follow. */
  readonly host: OtelReceiverHost
  /** Picks the port to try each time the receiver is turned on. Defaults to a random port; tests return 0. */
  readonly pickPort?: () => number
}

/**
 * Builds the opt-in telemetry receiver, starts it when the saved setting is
 * on, and stops it when the app quits. Call it in the same tick the first
 * window is created: the start is then queued before any IPC call can arrive,
 * and reads of the receiver queue behind it, so the page never sees a receiver
 * that is on but not yet started. A server that fails after it started
 * listening is reported to the host, and a host that throws is logged. A start
 * or stop that fails is logged by its code or class name, never by its message.
 *
 * @param options - The settings file, the app events, and optionally the port picker.
 * @returns The runtime to pass to the IPC handlers.
 */
export function wireOtelReceiver(options: WireOtelReceiverOptions): OtelRuntime {
  const { settingsPath, host, pickPort } = options
  const otel = createOtelRuntime({
    settingsPath,
    pickPort,
    // Runs inside the server's 'error' listener, where a throw would be uncaught.
    onReceiverFailure: () => {
      try {
        host.notifyReceiverChanged()
      } catch (error) {
        console.error(
          `The telemetry receiver's change could not reach the windows (${describeError(error)}).`
        )
      }
    }
  })
  // Not awaited, so the window never waits on it.
  otel.receiver.startFromSettings().catch((error: unknown) => {
    console.error(`Beekeeper could not start the telemetry receiver (${describeError(error)}).`)
  })
  host.onWillQuit(() => {
    otel.receiver.stop().catch((error: unknown) => {
      console.error(`Beekeeper could not stop the telemetry receiver (${describeError(error)}).`)
    })
  })
  return otel
}
