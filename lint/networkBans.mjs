// @ts-check
export const NETWORK_MODULE_MESSAGE =
  'Beekeeper makes no outbound network calls. The one exception is the opt-in loopback telemetry receiver in src/main/otel. See the privacy promise in the README.'

/**
 * The imports that would let the app reach the network, as the `paths` option
 * of `no-restricted-imports`.
 *
 * @type {{ name: string, importNames?: string[], message: string }[]}
 */
export const networkBannedImports = [
  ...['http', 'https', 'net', 'tls', 'dgram', 'http2'].flatMap((name) => [
    { name, message: NETWORK_MODULE_MESSAGE },
    { name: `node:${name}`, message: NETWORK_MODULE_MESSAGE }
  ]),
  { name: 'electron', importNames: ['net'], message: NETWORK_MODULE_MESSAGE }
]

/**
 * The one exception to the network bans: the telemetry receiver listens on
 * loopback with `node:http` and never makes an outbound request.
 */
export const telemetryReceiverImports = networkBannedImports.filter(
  ({ name }) => name !== 'http' && name !== 'node:http'
)

/** The globals that would let the renderer or main process reach the network, as `no-restricted-globals` entries. */
export const networkBannedGlobals = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map(
  (name) => ({ name, message: NETWORK_MODULE_MESSAGE })
)
