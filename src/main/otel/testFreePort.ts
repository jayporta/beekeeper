import { createServer } from 'node:http'

/**
 * Finds a loopback port nothing is listening on, for a test that needs to name
 * the port it starts a receiver on.
 *
 * @returns A port that was free a moment ago.
 */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => {
        if (port === 0) reject(new Error('no free port'))
        else resolve(port)
      })
    })
  })
}
