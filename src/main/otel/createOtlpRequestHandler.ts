import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describeError } from '../describeError'
import type { ReportedCostStore } from './createReportedCostStore'
import { parseOtlpLogs } from './parseOtlpLogs'
import { readLimitedBody } from './readLimitedBody'

/** The most request-body bytes the receiver reads. */
export const MAX_OTLP_BODY_BYTES = 2 * 1024 * 1024

/** What the handler needs to answer a request. */
export interface OtlpRequestHandlerOptions {
  /** The bearer token a request must carry. */
  readonly token: string
  /** Where accepted reports go. */
  readonly costs: ReportedCostStore
  /** The port the server is bound to, which the `Host` header must name. */
  readonly boundPort: () => number
}

function bearerToken(header: string | undefined): string | null {
  const match = header === undefined ? null : /^bearer (.+)$/i.exec(header)
  return match?.[1] ?? null
}

function tokensMatch(given: string, expected: string): boolean {
  const givenBytes = Buffer.from(given)
  const expectedBytes = Buffer.from(expected)
  return givenBytes.length === expectedBytes.length && timingSafeEqual(givenBytes, expectedBytes)
}

function isJson(contentType: string | undefined): boolean {
  return contentType?.split(';')[0]?.trim().toLowerCase() === 'application/json'
}

function isUncompressed(contentEncoding: string | undefined): boolean {
  return contentEncoding === undefined || contentEncoding.trim().toLowerCase() === 'identity'
}

/**
 * Answers a request and closes the connection. The body is `{}` for a
 * success, which is an empty OTLP response, and empty for a failure. Nothing
 * from the request is echoed back.
 */
function reply(res: ServerResponse, status: number): void {
  const body = status === 200 ? '{}' : ''
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    Connection: 'close'
  })
  res.end(body)
}

/** Answers like {@link reply}, then destroys the socket so a client still sending can't keep it busy. */
function replyAndDestroy(res: ServerResponse, status: number): void {
  const { socket } = res
  res.once('finish', () => socket?.destroy())
  reply(res, status)
}

/**
 * Creates the function that answers OTLP/HTTP JSON log exports. Checks run
 * cheapest first and the body is read only once the request passed all of
 * them: `Host` (403), `Origin` (403), the route (404), the bearer token
 * (401), the content type (415), the content encoding (415), then the body
 * size (413), JSON syntax and shape (400).
 *
 * @param options - The token, the store, and the bound port.
 * @returns A request listener for `http.createServer`.
 */
export function createOtlpRequestHandler(
  options: OtlpRequestHandlerOptions
): (req: IncomingMessage, res: ServerResponse) => void {
  const { token, costs, boundPort } = options

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const host = req.headers.host?.toLowerCase()
    const port = boundPort()
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return reply(res, 403)
    if (req.headers.origin !== undefined) return reply(res, 403)
    if (req.method !== 'POST' || req.url !== '/v1/logs') return reply(res, 404)
    const given = bearerToken(req.headers.authorization)
    if (given === null || !tokensMatch(given, token)) return reply(res, 401)
    if (!isJson(req.headers['content-type'])) return reply(res, 415)
    if (!isUncompressed(req.headers['content-encoding'])) return reply(res, 415)
    if (Number(req.headers['content-length']) > MAX_OTLP_BODY_BYTES) {
      return replyAndDestroy(res, 413)
    }

    const body = await readLimitedBody(req, MAX_OTLP_BODY_BYTES)
    if (!body.ok) {
      if (body.reason === 'too-large') replyAndDestroy(res, 413)
      else res.destroy()
      return
    }
    let json: unknown
    try {
      json = JSON.parse(body.text)
    } catch {
      return reply(res, 400)
    }
    const parsed = parseOtlpLogs(json)
    if (!parsed.ok) return reply(res, 400)
    costs.record(parsed.value)
    reply(res, 200)
  }

  return (req, res) => {
    handle(req, res).catch((error: unknown) => {
      console.error(`The telemetry receiver failed to answer a request (${describeError(error)}).`)
      if (res.headersSent) res.destroy()
      else reply(res, 500)
    })
  }
}
