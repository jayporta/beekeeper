import { request } from 'node:http'
import { networkInterfaces } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createReportedCostStore, type ReportedCostStore } from '../createReportedCostStore'
import { createOtelReceiver, type OtelReceiver } from '../createOtelReceiver'
import { apiRequestAttributes, logRecord, otlpLogsBody, TEST_SESSION_ID } from '../testOtlpLogs'
import { sendToReceiver, TEST_TOKEN } from '../testOtelClient'

/** The 2 MiB body cap, written out so a change to the constant fails these tests. */
const TWO_MIB = 2 * 1024 * 1024

let costs: ReportedCostStore
let receiver: OtelReceiver
let port = 0

const OTHER_TOKEN = 'another-token-another-token-another-token-12'

/** Headers that pass every check, so a request with a short body waits for the rest of it. */
const holdOpenHeaders = {
  authorization: `Bearer ${TEST_TOKEN}`,
  'content-type': 'application/json'
}

const validBody = (): string => JSON.stringify(otlpLogsBody([logRecord(apiRequestAttributes())]))

async function startReceiver(requestTimeoutMs?: number): Promise<void> {
  costs = createReportedCostStore()
  receiver = createOtelReceiver({ costs, requestTimeoutMs })
  const state = await receiver.start({ token: TEST_TOKEN, port: 0 })
  if (state.status !== 'listening') throw new Error('the test receiver did not start')
  port = state.port
}

beforeEach(async () => {
  await startReceiver()
})

afterEach(async () => {
  await receiver.stop()
})

describe('createOtelReceiver requests', () => {
  it('answers 200 with an empty JSON object and records the reported cost', async () => {
    const response = await sendToReceiver({ port, body: validBody() })

    expect([response.status, response.body, response.headers['content-type']]).toEqual([
      200,
      '{}',
      'application/json'
    ])
    expect(costs.get(TEST_SESSION_ID)).toMatchObject({ costUsd: 0.25, requests: 1 })
  })

  it('answers 200 and records nothing for a batch with no api_request events', async () => {
    const body = JSON.stringify(
      otlpLogsBody([logRecord(apiRequestAttributes({ 'event.name': 'tool_result' }))])
    )

    const response = await sendToReceiver({ port, body })

    expect([response.status, costs.get(TEST_SESSION_ID)]).toEqual([200, null])
  })

  it('counts a retried export once', async () => {
    const body = JSON.stringify(
      otlpLogsBody([logRecord(apiRequestAttributes({ request_id: 'req_1' }))])
    )

    await sendToReceiver({ port, body })
    await sendToReceiver({ port, body })

    expect(costs.get(TEST_SESSION_ID)?.requests).toBe(1)
  })

  it('accepts a content type with parameters', async () => {
    const response = await sendToReceiver({
      port,
      body: validBody(),
      headers: { 'content-type': 'Application/JSON; charset=utf-8' }
    })

    expect(response.status).toBe(200)
  })

  it('accepts an identity content encoding', async () => {
    const response = await sendToReceiver({
      port,
      body: validBody(),
      headers: { 'content-encoding': 'identity' }
    })

    expect(response.status).toBe(200)
  })

  it('accepts the localhost host name', async () => {
    const response = await sendToReceiver({
      port,
      body: validBody(),
      headers: { host: `LocalHost:${port}` }
    })

    expect(response.status).toBe(200)
  })

  it.each([
    ['no authorization header', undefined],
    ['the wrong token', 'Bearer wrong-token-wrong-token-wrong-token-wrong'],
    ['a token of another length', 'Bearer short'],
    ['a token of the right length', `Bearer ${TEST_TOKEN.slice(0, -1)}2`],
    ['the token without a scheme', TEST_TOKEN],
    ['a basic scheme', `Basic ${TEST_TOKEN}`]
  ])('answers 401 and records nothing for %s', async (_name, authorization) => {
    const response = await sendToReceiver({
      port,
      body: validBody(),
      headers: { authorization }
    })

    expect([response.status, costs.get(TEST_SESSION_ID)]).toEqual([401, null])
  })

  it('answers 403 for a request with an Origin header, even with a valid token', async () => {
    const response = await sendToReceiver({
      port,
      body: validBody(),
      headers: { origin: 'https://example.com' }
    })

    expect([response.status, costs.get(TEST_SESSION_ID)]).toEqual([403, null])
  })

  it('answers 403 for an empty Origin header', async () => {
    const response = await sendToReceiver({ port, body: validBody(), headers: { origin: '' } })

    expect(response.status).toBe(403)
  })

  it.each([
    ['another host name', 'evil.example.com'],
    ['the right name with another port', '127.0.0.1:1'],
    ['the name with no port', '127.0.0.1'],
    ['a rebinding name on the right port', 'REBIND']
  ])('answers 403 for %s in the Host header', async (_name, host) => {
    const response = await sendToReceiver({
      port,
      body: validBody(),
      headers: { host: host === 'REBIND' ? `evil.example.com:${port}` : host }
    })

    expect([response.status, costs.get(TEST_SESSION_ID)]).toEqual([403, null])
  })

  it('answers 403 before 401 so a rebinding page learns nothing about the token', async () => {
    const response = await sendToReceiver({
      port,
      body: validBody(),
      headers: { host: 'evil.example.com', authorization: undefined }
    })

    expect(response.status).toBe(403)
  })

  it.each([
    ['another path', 'POST', '/v1/metrics'],
    ['the root', 'POST', '/'],
    ['a path with a query', 'POST', '/v1/logs?x=1'],
    ['another method', 'GET', '/v1/logs'],
    ['a put', 'PUT', '/v1/logs']
  ])('answers 404 for %s', async (_name, method, path) => {
    const response = await sendToReceiver({ port, method, path, body: validBody() })

    expect([response.status, costs.get(TEST_SESSION_ID)]).toEqual([404, null])
  })

  it.each([['text/plain'], ['application/jsonx'], ['application/x-protobuf'], [undefined]])(
    'answers 415 for the content type %s',
    async (contentType) => {
      const response = await sendToReceiver({
        port,
        body: validBody(),
        headers: { 'content-type': contentType }
      })

      expect([response.status, costs.get(TEST_SESSION_ID)]).toEqual([415, null])
    }
  )

  it.each(['gzip', 'deflate', 'br', 'gzip, identity'])(
    'answers 415 for the content encoding %s',
    async (encoding) => {
      const response = await sendToReceiver({
        port,
        body: validBody(),
        headers: { 'content-encoding': encoding }
      })

      expect([response.status, costs.get(TEST_SESSION_ID)]).toEqual([415, null])
    }
  )

  it('answers 413 for a declared length over the cap without reading the body', async () => {
    const response = await sendToReceiver({
      port,
      body: validBody(),
      headers: { 'content-length': String(TWO_MIB + 1) }
    })

    expect([response.status, costs.get(TEST_SESSION_ID)]).toEqual([413, null])
  })

  it('answers 413 or resets a streamed body past the cap, and records nothing', async () => {
    const body = JSON.stringify({
      ...(otlpLogsBody([logRecord(apiRequestAttributes())]) as object),
      padding: 'x'.repeat(TWO_MIB)
    })

    // The receiver destroys the socket after answering, so a client still writing may see a reset instead.
    const outcome = await sendToReceiver({ port, body, chunked: true }).then(
      (response) => response.status,
      () => 'reset'
    )

    expect([413, 'reset']).toContain(outcome)
    expect(costs.get(TEST_SESSION_ID)).toBeNull()
  })

  it('accepts a streamed body just under the cap', async () => {
    const body = JSON.stringify({
      ...(otlpLogsBody([logRecord(apiRequestAttributes())]) as object),
      padding: 'x'.repeat(TWO_MIB - 1000)
    })

    const response = await sendToReceiver({ port, body, chunked: true })

    expect([response.status, costs.get(TEST_SESSION_ID)?.requests]).toEqual([200, 1])
  })

  it.each([
    ['text that is not JSON', 'not json'],
    ['an empty body', ''],
    ['JSON that is not an OTLP request', '{"hello":"world"}'],
    ['a JSON array', '[]']
  ])('answers 400 for %s', async (_name, body) => {
    const response = await sendToReceiver({ port, body })

    expect([response.status, costs.get(TEST_SESSION_ID)]).toEqual([400, null])
  })

  it('answers a failure with an empty body', async () => {
    const response = await sendToReceiver({
      port,
      body: validBody(),
      headers: { authorization: undefined }
    })

    expect([response.status, response.body]).toEqual([401, ''])
  })

  it('never echoes the request body or the token', async () => {
    const response = await sendToReceiver({ port, body: 'secret-prompt-content' })

    expect(response.body).not.toContain('secret')
    expect(response.body).not.toContain(TEST_TOKEN)
  })
})

describe('createOtelReceiver limits', () => {
  it('closes a request that stalls past the timeout', async () => {
    await receiver.stop()
    await startReceiver(150)

    const outcome = await new Promise<string>((resolve) => {
      const req = request({
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: '/v1/logs',
        agent: false,
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          'content-type': 'application/json',
          'content-length': '1000'
        }
      })
      req.on('response', (res) => resolve(`status ${res.statusCode ?? 0}`))
      req.on('error', () => resolve('closed'))
      req.write('{"resourceLogs":')
    })

    expect(['status 408', 'closed']).toContain(outcome)
    expect(costs.get(TEST_SESSION_ID)).toBeNull()
  })

  it('drops connections past the 4th open one', async () => {
    const open = Array.from({ length: 4 }, () => {
      const req = request({
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: '/v1/logs',
        agent: false,
        headers: { ...holdOpenHeaders, 'content-length': '100' }
      })
      req.on('error', () => undefined)
      req.write('{')
      return req
    })
    await new Promise((resolve) => setTimeout(resolve, 100))

    const fifth = await sendToReceiver({ port, body: validBody() }).then(
      (response) => `status ${response.status}`,
      () => 'dropped'
    )
    open.forEach((req) => req.destroy())

    expect(fifth).toBe('dropped')
  })
})

describe('createOtelReceiver binding', () => {
  const externalAddress = Object.values(networkInterfaces())
    .flat()
    .find((entry) => entry?.family === 'IPv4' && !entry.internal)?.address

  it('listens on the loopback address', async () => {
    const response = await sendToReceiver({ port, body: validBody(), host: '127.0.0.1' })

    expect(response.status).toBe(200)
  })

  it.skipIf(externalAddress === undefined)(
    'refuses connections on a non-loopback address of the machine',
    async () => {
      const outcome = await sendToReceiver({
        port,
        body: validBody(),
        host: externalAddress,
        timeoutMs: 1000,
        headers: { host: `127.0.0.1:${port}` }
      }).then(
        () => 'connected',
        () => 'refused'
      )

      expect(outcome).toBe('refused')
    }
  )
})

describe('createOtelReceiver lifecycle', () => {
  it('is off until started', () => {
    expect(createOtelReceiver({ costs: createReportedCostStore() }).state()).toEqual({
      status: 'off'
    })
  })

  it('reports the port it listens on', () => {
    expect(receiver.state()).toEqual({ status: 'listening', port })
  })

  it('listens on the port it is started with', async () => {
    await receiver.stop()

    const state = await receiver.start({ token: TEST_TOKEN, port })

    expect(state).toEqual({ status: 'listening', port })
  })

  it('returns the current state, and keeps the current token and port, when started while listening', async () => {
    const state = await receiver.start({ token: OTHER_TOKEN, port: port === 1 ? 2 : 1 })

    const [oldToken, newToken] = await Promise.all([
      sendToReceiver({ port, body: validBody() }),
      sendToReceiver({
        port,
        body: validBody(),
        headers: { authorization: `Bearer ${OTHER_TOKEN}` }
      })
    ])
    expect([state, oldToken.status, newToken.status]).toEqual([
      { status: 'listening', port },
      200,
      401
    ])
  })

  it('stops listening', async () => {
    await receiver.stop()

    const outcome = await sendToReceiver({ port, body: validBody() }).then(
      () => 'connected',
      () => 'refused'
    )
    expect([receiver.state(), outcome]).toEqual([{ status: 'off' }, 'refused'])
  })

  it('stops while a client holds a connection open', async () => {
    const req = request({
      host: '127.0.0.1',
      port,
      method: 'POST',
      path: '/v1/logs',
      agent: false,
      headers: { ...holdOpenHeaders, 'content-length': '100' }
    })
    req.on('error', () => undefined)
    req.write('{')
    await new Promise((resolve) => setTimeout(resolve, 50))

    await receiver.stop()

    expect(receiver.state()).toEqual({ status: 'off' })
  })

  it('does nothing when stopped without being started', async () => {
    const idle = createOtelReceiver({ costs: createReportedCostStore() })

    await idle.stop()

    expect(idle.state()).toEqual({ status: 'off' })
  })

  it('accepts only the new token after a restart', async () => {
    await receiver.stop()
    const state = await receiver.start({ token: OTHER_TOKEN, port: 0 })
    if (state.status !== 'listening') throw new Error('the test receiver did not restart')

    const [oldToken, newToken] = await Promise.all([
      sendToReceiver({ port: state.port, body: validBody() }),
      sendToReceiver({
        port: state.port,
        body: validBody(),
        headers: { authorization: `Bearer ${OTHER_TOKEN}` }
      })
    ])

    expect([oldToken.status, newToken.status]).toEqual([401, 200])
  })

  it('reports port-in-use when another listener holds the port', async () => {
    const second = createOtelReceiver({ costs: createReportedCostStore() })

    expect(await second.start({ token: TEST_TOKEN, port })).toEqual({
      status: 'failed',
      failure: 'port-in-use'
    })
  })

  it('reports a generic failure for a port that cannot be bound', async () => {
    const invalid = createOtelReceiver({ costs: createReportedCostStore() })

    expect(await invalid.start({ token: TEST_TOKEN, port: 70000 })).toEqual({
      status: 'failed',
      failure: 'failed'
    })
  })

  it('can start again after a failure', async () => {
    await receiver.stop()
    const holder = createOtelReceiver({ costs: createReportedCostStore() })
    await holder.start({ token: TEST_TOKEN, port })
    const contender = createOtelReceiver({ costs: createReportedCostStore() })
    await contender.start({ token: TEST_TOKEN, port })

    await holder.stop()
    const retry = await contender.start({ token: TEST_TOKEN, port })

    expect(retry).toEqual({ status: 'listening', port })
    await contender.stop()
  })

  it('serves a start and a stop issued together in order', async () => {
    await receiver.stop()

    const [started] = await Promise.all([
      receiver.start({ token: TEST_TOKEN, port: 0 }),
      receiver.stop()
    ])

    expect([started.status, receiver.state()]).toEqual(['listening', { status: 'off' }])
  })
})
