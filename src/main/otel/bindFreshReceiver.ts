import type { OtelReceiverFailureDto } from '../../shared/ipc/otelReceiverFailureDto'
import type { OtelReceiver } from './createOtelReceiver'
import type { OtelBinding } from './otelBinding'

/** How many random ports are tried before giving up on turning the receiver on. */
export const MAX_BIND_ATTEMPTS = 5

/** What {@link bindFreshReceiver} needs. */
export interface BindFreshReceiverOptions {
  /** The server to start. It must not be listening. */
  readonly receiver: OtelReceiver
  /** Picks the next port to try. */
  readonly pickPort: () => number
  /** Creates the token for this start. */
  readonly newToken: () => string
}

/** The outcome of {@link bindFreshReceiver}. */
export type BindFreshReceiverResult =
  | { readonly ok: true; readonly binding: OtelBinding }
  | { readonly ok: false; readonly failure: OtelReceiverFailureDto }

/**
 * Starts the receiver on a new random port with a new token. A port that is in
 * use is tried again with another, up to {@link MAX_BIND_ATTEMPTS} times, and
 * any other failure stops at once. Nothing is saved here.
 *
 * @param options - The receiver, the port picker and the token source.
 * @returns The token and the port the server actually bound, or why the last attempt failed.
 */
export async function bindFreshReceiver(
  options: BindFreshReceiverOptions
): Promise<BindFreshReceiverResult> {
  const { receiver, pickPort, newToken } = options
  const token = newToken()
  let failure: OtelReceiverFailureDto = 'failed'
  for (let attempt = 0; attempt < MAX_BIND_ATTEMPTS; attempt++) {
    const state = await receiver.start({ token, port: pickPort() })
    if (state.status === 'listening') return { ok: true, binding: { token, port: state.port } }
    if (state.status === 'failed') failure = state.failure
    if (failure !== 'port-in-use') break
  }
  return { ok: false, failure }
}
