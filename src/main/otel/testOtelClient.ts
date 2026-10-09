import { request, type IncomingHttpHeaders } from 'node:http'

/** The bearer token the receiver tests start the receiver with. */
export const TEST_TOKEN = 'test-token-test-token-test-token-test-token-1'

const CHUNK_BYTES = 64 * 1024

/** What a test request sends; `undefined` in `headers` removes a default header. */
export interface TestRequestOptions {
  /** The receiver's port on 127.0.0.1. */
  readonly port: number
  /** The HTTP method. Defaults to `POST`. */
  readonly method?: string
  /** The request path. Defaults to `/v1/logs`. */
  readonly path?: string
  /** Headers over the defaults: a valid bearer token and a JSON content type. */
  readonly headers?: Readonly<Record<string, string | undefined>>
  /** The body. Defaults to none. */
  readonly body?: string | Buffer
  /** Sends the body in chunks with no `Content-Length`, so the receiver can't see its size up front. */
  readonly chunked?: boolean
  /** The host to connect to. Defaults to 127.0.0.1. */
  readonly host?: string
  /** Gives up with an error after this many milliseconds of silence. Defaults to no limit. */
  readonly timeoutMs?: number
}

/** What the receiver answered. */
export interface TestResponse {
  /** The status code. */
  readonly status: number
  /** The response body. */
  readonly body: string
  /** The response headers. */
  readonly headers: IncomingHttpHeaders
}

/**
 * Sends one request to a receiver and resolves with its answer. A connection
 * the receiver resets after it answered still resolves with the answer.
 *
 * @param options - The request.
 * @returns The status, body and headers.
 */
export function sendToReceiver(options: TestRequestOptions): Promise<TestResponse> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${TEST_TOKEN}`,
    'content-type': 'application/json'
  }
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    if (value === undefined) delete headers[name.toLowerCase()]
    else headers[name.toLowerCase()] = value
  }
  return new Promise((resolve, reject) => {
    let answered = false
    const req = request(
      {
        host: options.host ?? '127.0.0.1',
        port: options.port,
        method: options.method ?? 'POST',
        path: options.path ?? '/v1/logs',
        headers,
        agent: false,
        timeout: options.timeoutMs
      },
      (res) => {
        answered = true
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: res.headers
          })
        })
        res.on('error', () => undefined)
      }
    )
    req.on('error', (error) => {
      if (!answered) reject(error)
    })
    req.on('timeout', () => req.destroy(new Error('no answer')))
    if (options.chunked && options.body !== undefined) {
      const bytes = Buffer.from(options.body)
      for (let at = 0; at < bytes.length; at += CHUNK_BYTES) {
        req.write(bytes.subarray(at, at + CHUNK_BYTES))
      }
      req.end()
    } else {
      req.end(options.body)
    }
  })
}
