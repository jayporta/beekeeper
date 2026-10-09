import { randomBytes, randomInt } from 'node:crypto'

/** The lowest port the receiver picks. The pool stays clear of the Linux and macOS ephemeral ranges and of Kubernetes NodePorts. */
export const OTEL_PORT_MIN = 20000

/** The highest port the receiver picks. */
export const OTEL_PORT_MAX = 29999

/** The loopback endpoint Claude Code exports to: the port the receiver listens on and the token it requires. */
export interface OtelBinding {
  /** The bearer token every request must carry. */
  readonly token: string
  /** The loopback port to listen on; 0 lets the system pick, which only tests use. */
  readonly port: number
}

/**
 * Picks a port for the receiver at random.
 *
 * @returns A port from 20000 to 29999.
 */
export function randomOtelPort(): number {
  return randomInt(OTEL_PORT_MIN, OTEL_PORT_MAX + 1)
}

/**
 * Creates a bearer token for the receiver.
 *
 * @returns 32 random bytes as base64url, 43 characters.
 */
export function randomOtelToken(): string {
  return randomBytes(32).toString('base64url')
}
