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

const HTTP_MODULES = ['http', 'node:http']

const bansOtherThanHttp = networkBannedImports.filter(({ name }) => !HTTP_MODULES.includes(name))

/** The `node:http` names the telemetry receiver's source may import: a server and its types, never a client. */
const RECEIVER_HTTP_NAMES = ['createServer', 'Server', 'IncomingMessage', 'ServerResponse']

/** Also allowed in its tests and test helpers, which call the receiver as a client would. */
const RECEIVER_TEST_HTTP_NAMES = [...RECEIVER_HTTP_NAMES, 'request', 'IncomingHttpHeaders']

/**
 * @param {string[]} allowImportNames
 * @returns {{ name: string, allowImportNames: string[], message: string }[]}
 */
const httpOnly = (allowImportNames) =>
  HTTP_MODULES.map((name) => ({ name, allowImportNames, message: NETWORK_MODULE_MESSAGE }))

/**
 * The one exception to the network bans: the telemetry receiver listens on
 * loopback with `node:http` and never makes an outbound request, so its
 * source may import only a server and its types. Every other ban stays.
 */
export const telemetryReceiverImports = [...bansOtherThanHttp, ...httpOnly(RECEIVER_HTTP_NAMES)]

/** The receiver's tests and test helpers, which may also send requests to it. */
export const telemetryReceiverTestImports = [
  ...bansOtherThanHttp,
  ...httpOnly(RECEIVER_TEST_HTTP_NAMES)
]

/** The globals that would let the renderer or main process reach the network, as `no-restricted-globals` entries. */
export const networkBannedGlobals = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map(
  (name) => ({ name, message: NETWORK_MODULE_MESSAGE })
)
