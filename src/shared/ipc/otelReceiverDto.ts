import type { OtelReceiverFailureDto } from './otelReceiverFailureDto'

/** Whether the telemetry receiver is accepting Claude Code's exports. */
export type OtelReceiverStatusDto = 'off' | 'listening' | 'failed'

/** The opt-in telemetry receiver: the setting, and whether the server is up. */
export interface OtelReceiverDto {
  /** Whether the person turned the receiver on. */
  readonly enabled: boolean
  /** `listening` when the server is up, `failed` when it was turned on but couldn't start, otherwise `off`. */
  readonly status: OtelReceiverStatusDto
  /** Why a `failed` receiver isn't listening; `null` otherwise. */
  readonly failure: OtelReceiverFailureDto | null
  /** The loopback port Claude Code should export to. */
  readonly port: number
  /** The bearer token Claude Code must send, or `null` while the receiver is off. A secret: never log or persist it in the renderer. */
  readonly token: string | null
}
