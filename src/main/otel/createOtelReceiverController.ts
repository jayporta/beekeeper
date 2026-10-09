import type { OtelReceiverDto } from '../../shared/ipc/otelReceiverDto'
import type { OtelReceiver, OtelReceiverState } from './createOtelReceiver'
import type { OtelSettings, OtelSettingsStore } from './otelSettings'
import { createSerialQueue } from './serialQueue'

/** The person's on/off choice for the telemetry receiver, joined to the server that honors it. */
export interface OtelReceiverController {
  /**
   * Reads the setting and the server's state.
   *
   * @returns The receiver as the renderer sees it. The token is present only while the setting is on.
   */
  get(): Promise<OtelReceiverDto>

  /**
   * Saves the choice and starts or stops the server to match. Turning it on
   * keeps the setting on even when the server can't start, and reports why.
   *
   * @param enabled - The new setting.
   * @returns The receiver afterwards.
   * @throws When the setting can't be saved. The server is left as it was.
   */
  setEnabled(enabled: boolean): Promise<OtelReceiverDto>

  /**
   * Starts the server when the saved setting is on. Call it once at launch.
   *
   * @throws When the saved setting can't be read.
   */
  startFromSettings(): Promise<void>

  /** Stops the server without changing the saved setting. Call it on quit. */
  stop(): Promise<void>
}

/** What the controller joins. */
export interface OtelReceiverControllerOptions {
  /** Where the on/off choice and the token are saved. */
  readonly settings: OtelSettingsStore
  /** The server to start and stop. */
  readonly receiver: OtelReceiver
  /** The port reported while the server isn't listening, which is the one it will try. */
  readonly port: number
}

function toDto(settings: OtelSettings, state: OtelReceiverState, port: number): OtelReceiverDto {
  if (!settings.enabled) {
    return { enabled: false, status: 'off', failure: null, port, token: null }
  }
  switch (state.status) {
    case 'listening':
      return {
        enabled: true,
        status: 'listening',
        failure: null,
        port: state.port,
        token: settings.token
      }
    case 'failed':
      return {
        enabled: true,
        status: 'failed',
        failure: state.failure,
        port,
        token: settings.token
      }
    case 'off':
      return { enabled: true, status: 'off', failure: null, port, token: settings.token }
  }
}

/**
 * Joins the saved setting to the receiver. Calls run one at a time, in order,
 * so a quick on and off can't leave the server running against an off setting.
 *
 * @param options - The settings store, the receiver, and the port to report.
 * @returns A controller over them.
 */
export function createOtelReceiverController(
  options: OtelReceiverControllerOptions
): OtelReceiverController {
  const { settings, receiver, port } = options
  const serialize = createSerialQueue()

  async function read(): Promise<OtelReceiverDto> {
    return toDto(await settings.read(), receiver.state(), port)
  }

  return {
    get: () => serialize(read),
    setEnabled: (enabled) =>
      serialize(async () => {
        if (!enabled) await receiver.stop()
        const saved = await settings.setEnabled(enabled)
        if (enabled && saved.token !== null) await receiver.start(saved.token)
        return read()
      }),
    startFromSettings: () =>
      serialize(async () => {
        const saved = await settings.read()
        if (saved.enabled && saved.token !== null) await receiver.start(saved.token)
      }),
    stop: () => serialize(() => receiver.stop())
  }
}
