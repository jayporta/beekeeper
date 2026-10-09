import type { OtelReceiverFailureDto } from './otelReceiverFailureDto'

/**
 * The opt-in telemetry receiver: the setting, and whether the server is up.
 * While the receiver is on it has a port and a token. Both are new each time
 * the person turns it on, and neither exists while it is off.
 */
export type OtelReceiverDto =
  | {
      /** The person turned the receiver on. */
      readonly enabled: true
      /** `listening` when the server is up, `failed` when it couldn't start or stopped. */
      readonly status: 'listening' | 'failed'
      /** Why a `failed` receiver isn't listening; `null` while it listens. */
      readonly failure: OtelReceiverFailureDto | null
      /** The loopback port Claude Code should export to. */
      readonly port: number
      /** The bearer token Claude Code must send. A secret: never log or persist it in the renderer. */
      readonly token: string
    }
  | {
      /** The receiver is off. */
      readonly enabled: false
      /** The receiver isn't listening and nothing is wrong. */
      readonly status: 'off'
      /** Always `null`: nothing failed. */
      readonly failure: null
    }
  | {
      /** The receiver is off because the last attempt to turn it on failed. */
      readonly enabled: false
      /** The attempt failed and nothing was saved. */
      readonly status: 'failed'
      /** Why the attempt failed; this holds until the next change. */
      readonly failure: OtelReceiverFailureDto
    }
