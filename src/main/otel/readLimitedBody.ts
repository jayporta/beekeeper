import type { IncomingMessage } from 'node:http'

/** The outcome of reading a request body. */
export type LimitedBody =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: 'too-large' | 'aborted' }

/**
 * Reads a request body as UTF-8 text, giving up once it passes a byte cap.
 * After giving up, later chunks are dropped unread.
 *
 * @param req - The request to read.
 * @param maxBytes - The most bytes to accept.
 * @returns The text, `too-large` once the body passes the cap, or `aborted`
 * when the client closed the connection before the body ended.
 */
export function readLimitedBody(req: IncomingMessage, maxBytes: number): Promise<LimitedBody> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    const settle = (result: LimitedBody): void => {
      if (settled) return
      settled = true
      chunks.length = 0
      resolve(result)
    }
    req.on('data', (chunk: Buffer) => {
      if (settled) return
      size += chunk.length
      if (size > maxBytes) settle({ ok: false, reason: 'too-large' })
      else chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      const text = Buffer.concat(chunks).toString('utf8')
      settle({ ok: true, text })
    })
    req.on('error', () => settle({ ok: false, reason: 'aborted' }))
    req.on('close', () => settle({ ok: false, reason: 'aborted' }))
  })
}
