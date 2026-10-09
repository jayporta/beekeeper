import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createOtelRuntime, type OtelRuntime } from '../createOtelRuntime'
import { sendToReceiver } from '../testOtelClient'
import { apiRequestAttributes, logRecord, otlpLogsBody, TEST_SESSION_ID } from '../testOtlpLogs'

let dir = ''
let runtime: OtelRuntime

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-otel-runtime-'))
  runtime = createOtelRuntime({
    settingsPath: join(dir, 'otel', 'otel-receiver.json'),
    pickPort: () => 0
  })
})

afterEach(async () => {
  await runtime.receiver.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('createOtelRuntime', () => {
  it('stores what the receiver accepts in the store the runtime exposes', async () => {
    const dto = await runtime.receiver.setEnabled(true)
    if (!dto.enabled) throw new Error('the receiver did not turn on')

    await sendToReceiver({
      port: dto.port,
      body: JSON.stringify(otlpLogsBody([logRecord(apiRequestAttributes())])),
      headers: { authorization: `Bearer ${dto.token}` }
    })

    expect(runtime.costs.get(TEST_SESSION_ID)).toMatchObject({ costUsd: 0.25, requests: 1 })
  })

  it('forgets what the receiver heard when it is turned off', async () => {
    const dto = await runtime.receiver.setEnabled(true)
    if (!dto.enabled) throw new Error('the receiver did not turn on')
    await sendToReceiver({
      port: dto.port,
      body: JSON.stringify(otlpLogsBody([logRecord(apiRequestAttributes())])),
      headers: { authorization: `Bearer ${dto.token}` }
    })

    await runtime.receiver.setEnabled(false)

    expect(runtime.costs.get(TEST_SESSION_ID)).toBeNull()
  })

  it('starts off, with nothing reported', async () => {
    expect(await runtime.receiver.get()).toMatchObject({ enabled: false, status: 'off' })
    expect(runtime.costs.get(TEST_SESSION_ID)).toBeNull()
  })
})
