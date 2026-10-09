import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createReportedCostStore } from '../createReportedCostStore'
import { createOtelReceiver, type OtelReceiver } from '../createOtelReceiver'
import { apiRequestAttributes, logRecord, otlpLogsBody } from '../testOtlpLogs'
import { sendToReceiver, TEST_TOKEN } from '../testOtelClient'

const created = vi.hoisted((): Server[] => [])

vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>()
  return {
    ...actual,
    createServer: (...args: Parameters<typeof actual.createServer>) => {
      const server = actual.createServer(...args)
      created.push(server)
      return server
    }
  }
})

const validBody = (): string => JSON.stringify(otlpLogsBody([logRecord(apiRequestAttributes())]))

let receiver: OtelReceiver

beforeEach(() => {
  created.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  receiver = createOtelReceiver({ costs: createReportedCostStore() })
})

afterEach(async () => {
  await receiver.stop()
  vi.restoreAllMocks()
})

describe('createOtelReceiver late errors', () => {
  it('keeps a replaced server listening when the old server reports an error late', async () => {
    await receiver.start({ token: TEST_TOKEN, port: 0 })
    const [oldServer] = created
    await receiver.stop()
    const replacement = await receiver.start({ token: TEST_TOKEN, port: 0 })
    if (replacement.status !== 'listening') throw new Error('the test receiver did not restart')

    oldServer?.emit('error', new Error('late'))

    const response = await sendToReceiver({ port: replacement.port, body: validBody() })
    expect([receiver.state(), response.status]).toEqual([replacement, 200])
  })

  it('stops a replaced server after the old server reports an error late', async () => {
    await receiver.start({ token: TEST_TOKEN, port: 0 })
    const [oldServer] = created
    await receiver.stop()
    const replacement = await receiver.start({ token: TEST_TOKEN, port: 0 })
    if (replacement.status !== 'listening') throw new Error('the test receiver did not restart')
    oldServer?.emit('error', new Error('late'))

    await receiver.stop()

    const outcome = await sendToReceiver({ port: replacement.port, body: validBody() }).then(
      () => 'connected',
      () => 'refused'
    )
    expect([receiver.state(), outcome]).toEqual([{ status: 'off' }, 'refused'])
  })

  it('reports a failure when the current server errors', async () => {
    await receiver.start({ token: TEST_TOKEN, port: 0 })
    const [current] = created

    current?.emit('error', new Error('boom'))

    expect(receiver.state()).toEqual({ status: 'failed', failure: 'failed' })
  })
})
