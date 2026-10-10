import { createServer, type Server } from 'node:http'
import { errorCode } from '../../core/shared/errorCode'
import type { OtelReceiverFailureDto } from '../../shared/ipc/otelReceiverFailureDto'
import { describeError } from '../describeError'
import { createOtlpRequestHandler } from './createOtlpRequestHandler'
import type { ReportedCostStore } from './createReportedCostStore'
import type { OtelBinding } from './otelBinding'
import { createSerialQueue } from './serialQueue'

/** The only address the receiver binds, so nothing off this machine can reach it. */
export const OTEL_RECEIVER_HOST = '127.0.0.1'

const MAX_CONNECTIONS = 4
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000

/** Whether the receiver is listening, and why not if it was turned on but couldn't. */
export type OtelReceiverState =
  | { readonly status: 'off' }
  | { readonly status: 'listening'; readonly port: number }
  | { readonly status: 'failed'; readonly failure: OtelReceiverFailureDto }

/** The opt-in server for Claude Code's OpenTelemetry log export. */
export interface OtelReceiver {
  /**
   * Starts listening on 127.0.0.1. Changes are applied one at a time, in order.
   *
   * @param binding - The bearer token every request must carry and the port to bind.
   * @returns The state afterwards. When already listening, that state is
   * returned and the token and port in use don't change, so a new token takes
   * effect only after {@link OtelReceiver.stop}.
   */
  start(binding: OtelBinding): Promise<OtelReceiverState>

  /** Stops listening and closes open connections. Does nothing when off. */
  stop(): Promise<void>

  /** The current state. */
  state(): OtelReceiverState
}

/** What the receiver needs. */
export interface OtelReceiverOptions {
  /** Where accepted reports go. */
  readonly costs: ReportedCostStore
  /** How long a request may take to send its headers and body. Defaults to 10 seconds. */
  readonly requestTimeoutMs?: number
  /** Called once the listening server fails and the state becomes `failed`. Not called for a server already stopped. */
  readonly onFailure?: () => void
}

type ListenResult =
  | { readonly ok: true; readonly port: number }
  | { readonly ok: false; readonly failure: OtelReceiverFailureDto }

function failureOf(error: unknown): OtelReceiverFailureDto {
  return errorCode(error) === 'EADDRINUSE' ? 'port-in-use' : 'failed'
}

function listen(server: Server, port: number): Promise<ListenResult> {
  return new Promise((resolve) => {
    server.once('error', (error: unknown) => resolve({ ok: false, failure: failureOf(error) }))
    try {
      server.listen({ host: OTEL_RECEIVER_HOST, port, exclusive: true }, () => {
        const address = server.address()
        resolve(
          typeof address === 'object' && address !== null
            ? { ok: true, port: address.port }
            : { ok: false, failure: 'failed' }
        )
      })
    } catch (error) {
      resolve({ ok: false, failure: failureOf(error) })
    }
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
    server.closeAllConnections()
  })
}

/**
 * Creates the telemetry receiver, which is off until started. It accepts only
 * authenticated `POST /v1/logs` exports of `claude_code.api_request` events
 * and never makes an outbound request. Its logs name an error by code, never
 * by request content.
 *
 * @param options - The store, and optionally the request timeout and the failure callback.
 * @returns A receiver that is not yet listening.
 */
export function createOtelReceiver(options: OtelReceiverOptions): OtelReceiver {
  const { costs, requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, onFailure } = options
  let server: Server | null = null
  let current: OtelReceiverState = { status: 'off' }
  const serialize = createSerialQueue()

  async function startListening({ token, port }: OtelBinding): Promise<OtelReceiverState> {
    if (server !== null) return current
    let boundPort = port
    const created = createServer(
      // Timeouts are checked on this interval, which defaults to 30 seconds.
      { connectionsCheckingInterval: Math.max(25, Math.floor(requestTimeoutMs / 4)) },
      createOtlpRequestHandler({ token, costs, boundPort: () => boundPort })
    )
    created.requestTimeout = requestTimeoutMs
    created.headersTimeout = requestTimeoutMs
    created.maxConnections = MAX_CONNECTIONS
    const result = await listen(created, port)
    if (!result.ok) {
      current = { status: 'failed', failure: result.failure }
      return current
    }
    boundPort = result.port
    server = created
    created.on('error', (error: unknown) => {
      console.error(`The telemetry receiver stopped listening (${describeError(error)}).`)
      void closeServer(created)
      // A stopped server can still report late. Only the current one's error changes the state.
      if (server !== created) return
      server = null
      current = { status: 'failed', failure: 'failed' }
      onFailure?.()
    })
    current = { status: 'listening', port: result.port }
    return current
  }

  async function stopListening(): Promise<void> {
    const running = server
    server = null
    current = { status: 'off' }
    if (running !== null) await closeServer(running)
  }

  return {
    start: (binding) => serialize(() => startListening(binding)),
    stop: () => serialize(stopListening),
    state: () => current
  }
}
