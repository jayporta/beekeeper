import type { OtelReceiverDto } from '../../shared/ipc/otelReceiverDto'
import type { OtelReceiverFailureDto } from '../../shared/ipc/otelReceiverFailureDto'
import { bindFreshReceiver } from './bindFreshReceiver'
import type { OtelReceiver, OtelReceiverState } from './createOtelReceiver'
import type { ReportedCostStore } from './createReportedCostStore'
import { randomOtelPort, randomOtelToken } from './otelBinding'
import type { OtelSettings, OtelSettingsStore } from './otelSettings'
import { createSerialQueue } from './serialQueue'

/** The person's on/off choice for the telemetry receiver, joined to the server that honors it. */
export interface OtelReceiverController {
  /**
   * Reads the setting and the server's state.
   *
   * @returns The receiver as the renderer sees it. The port and token are present only while the setting is on.
   */
  get(): Promise<OtelReceiverDto>

  /**
   * Turns the receiver on or off. Turning it on from off starts the server on a
   * new random port with a new token, and saves the setting only once the
   * server is listening, with the port it bound. Turning it on while it is on
   * changes nothing. Turning it off saves the setting, stops the server and
   * forgets the reported costs.
   *
   * @param enabled - The new setting.
   * @returns The receiver afterwards. When no port could be bound, the setting
   * stays off and the result says why, until the next change.
   * @throws When the setting can't be saved. The server is left as it was, running or not.
   */
  setEnabled(enabled: boolean): Promise<OtelReceiverDto>

  /**
   * Starts the server on the saved port and token when the saved setting is on.
   * Call it once at launch, in the same tick the window is created: it is then
   * queued before any IPC call can arrive, and reads queue behind it, so the
   * renderer never sees a receiver that is on but not yet started. A saved port
   * that can't be bound is reported, not replaced.
   *
   * @throws When the saved setting can't be read.
   */
  startFromSettings(): Promise<void>

  /** Stops the server without changing the saved setting. Call it on quit. */
  stop(): Promise<void>
}

/** What the controller joins. */
export interface OtelReceiverControllerOptions {
  /** Where the on/off choice, the token and the port are saved. */
  readonly settings: OtelSettingsStore
  /** The server to start and stop. */
  readonly receiver: OtelReceiver
  /** What the server reported, which is forgotten when the receiver is turned off. */
  readonly costs: ReportedCostStore
  /** Picks the port to try when turning on. Defaults to a random port from 20000 to 29999. */
  readonly pickPort?: () => number
  /** Creates the token when turning on. Defaults to 32 random bytes as base64url. */
  readonly newToken?: () => string
}

/** What {@link toDto} combines. */
interface DtoParts {
  /** The saved setting. */
  readonly settings: OtelSettings
  /** The server's state. */
  readonly state: OtelReceiverState
  /** Why the last attempt to turn the receiver on failed, or `null`. */
  readonly turnOnFailure: OtelReceiverFailureDto | null
}

function toDto({ settings, state, turnOnFailure }: DtoParts): OtelReceiverDto {
  if (!settings.enabled) {
    return turnOnFailure === null
      ? { enabled: false, status: 'off', failure: null }
      : { enabled: false, status: 'failed', failure: turnOnFailure }
  }
  const { token, port } = settings
  if (state.status === 'listening') {
    return { enabled: true, status: 'listening', failure: null, port: state.port, token }
  }
  // An on receiver that isn't listening has failed or been stopped; either way nothing is receiving.
  const failure = state.status === 'failed' ? state.failure : 'failed'
  return { enabled: true, status: 'failed', failure, port, token }
}

/**
 * Joins the saved setting to the receiver. Calls run one at a time, in order,
 * so a quick on and off can't leave the server running against an off setting.
 *
 * @param options - The settings store, the receiver, the cost store, and optionally the port and token sources.
 * @returns A controller over them.
 */
export function createOtelReceiverController(
  options: OtelReceiverControllerOptions
): OtelReceiverController {
  const {
    settings,
    receiver,
    costs,
    pickPort = randomOtelPort,
    newToken = randomOtelToken
  } = options
  const serialize = createSerialQueue()
  let turnOnFailure: OtelReceiverFailureDto | null = null

  async function read(): Promise<OtelReceiverDto> {
    return toDto({ settings: await settings.read(), state: receiver.state(), turnOnFailure })
  }

  async function startSaved(): Promise<boolean> {
    const saved = await settings.read()
    if (saved.enabled) await receiver.start({ token: saved.token, port: saved.port })
    return saved.enabled
  }

  async function turnOff(): Promise<OtelReceiverDto> {
    await settings.disable()
    await receiver.stop()
    costs.clear()
    return read()
  }

  async function turnOn(): Promise<OtelReceiverDto> {
    if (await startSaved()) return read()
    // A server still listening would answer the start with its old token and port.
    await receiver.stop()
    const bound = await bindFreshReceiver({ receiver, pickPort, newToken })
    if (!bound.ok) {
      turnOnFailure = bound.failure
      return read()
    }
    try {
      await settings.enable(bound.binding)
    } catch (error) {
      await receiver.stop()
      throw error
    }
    return read()
  }

  return {
    get: () => serialize(read),
    setEnabled: (enabled) =>
      serialize(() => {
        turnOnFailure = null
        return enabled ? turnOn() : turnOff()
      }),
    startFromSettings: () =>
      serialize(async () => {
        await startSaved()
      }),
    stop: () => serialize(() => receiver.stop())
  }
}
