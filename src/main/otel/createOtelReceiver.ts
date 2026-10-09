import { createServer, type Server } from 'node:http'
import type { OtelReceiverFailureDto } from '../../shared/ipc/otelReceiverFailureDto'
import { describeError } from '../describeError'
import { createOtlpRequestHandler } from './createOtlpRequestHandler'
import type { ReportedCostStore } from './createReportedCostStore'
import { createSerialQueue } from './serialQueue'

/** The fixed port the receiver listens on, chosen to stay clear of a user's own collector on 4317 or 4318. */
export const OTEL_RECEIVER_PORT = 47318

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
   * @param token - The bearer token every request must carry.
   * @returns The state afterwards. When already listening, that state is
   * returned and the token in use doesn't change.
   */
  start(token: string): Promise<OtelReceiverState>

  /** Stops listening and closes open connections. Does nothing when off. */
  stop(): Promise<void>

  /** The current state. */
  state(): OtelReceiverState
}

/** What the receiver needs. */
export interface OtelReceiverOptions {
  /** Where accepted reports go. */
  readonly costs: ReportedCostStore
  /** The port to bind. Defaults to {@link OTEL_RECEIVER_PORT}; 0 picks a free one. */
  readonly port?: number
  /** How long a request may take to send its headers and body. Defaults to 10 seconds. */
  readonly requestTimeoutMs?: number
}

type ListenResult =
  | { readonly ok: true; readonly port: number }
  | { readonly ok: false; readonly failure: OtelReceiverFailureDto }

function failureOf(error: unknown): OtelReceiverFailureDto {
  return error instanceof Error && 'code' in error && error.code === 'EADDRINUSE'
    ? 'port-in-use'
    : 'failed'
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
 * @param options - The store, and optionally the port and the request timeout.
 * @returns A receiver that is not yet listening.
 */
export function createOtelReceiver(options: OtelReceiverOptions): OtelReceiver {
  const {
    costs,
    port = OTEL_RECEIVER_PORT,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
  } = options
  let server: Server | null = null
  let current: OtelReceiverState = { status: 'off' }
  const serialize = createSerialQueue()

  async function startListening(token: string): Promise<OtelReceiverState> {
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
      server = null
      current = { status: 'failed', failure: 'failed' }
      void closeServer(created)
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
    start: (token) => serialize(() => startListening(token)),
    stop: () => serialize(stopListening),
    state: () => current
  }
}
