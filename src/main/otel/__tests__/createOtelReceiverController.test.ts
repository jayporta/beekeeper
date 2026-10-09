import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createOtelReceiver, type OtelReceiver } from '../createOtelReceiver'
import {
  createOtelReceiverController,
  type OtelReceiverController
} from '../createOtelReceiverController'
import { createReportedCostStore } from '../createReportedCostStore'
import { createOtelSettingsStore, type OtelSettingsStore } from '../otelSettings'
import { sendToReceiver } from '../testOtelClient'
import { apiRequestAttributes, logRecord, otlpLogsBody } from '../testOtlpLogs'

let dir = ''
let settingsPath = ''
let settings: OtelSettingsStore
let controller: OtelReceiverController
let receiver: OtelReceiver
let stopAll: () => Promise<void>

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-otel-controller-'))
  settingsPath = join(dir, 'otel-receiver.json')
  ;({ controller, settings, receiver, stopAll } = build(settingsPath, 0))
})

afterEach(async () => {
  await stopAll()
  rmSync(dir, { recursive: true, force: true })
})

function build(
  path: string,
  port: number
): {
  controller: OtelReceiverController
  settings: OtelSettingsStore
  receiver: OtelReceiver
  stopAll: () => Promise<void>
} {
  const receiverSettings = createOtelSettingsStore(path)
  const receiver = createOtelReceiver({ costs: createReportedCostStore(), port })
  const built = createOtelReceiverController({ settings: receiverSettings, receiver, port })
  return { controller: built, settings: receiverSettings, receiver, stopAll: () => built.stop() }
}

const accepts = async (port: number, token: string): Promise<number> =>
  (
    await sendToReceiver({
      port,
      body: JSON.stringify(otlpLogsBody([logRecord(apiRequestAttributes())])),
      headers: { authorization: `Bearer ${token}` }
    })
  ).status

describe('createOtelReceiverController', () => {
  it('reports an off receiver with no token before anything is turned on', async () => {
    expect(await controller.get()).toEqual({
      enabled: false,
      status: 'off',
      failure: null,
      port: 0,
      token: null
    })
  })

  it('turns the receiver on, listening, with the token and the bound port', async () => {
    const dto = await controller.setEnabled(true)

    expect(dto).toMatchObject({ enabled: true, status: 'listening', failure: null })
    expect(dto.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(dto.port).toBeGreaterThan(0)
    expect(await accepts(dto.port, dto.token ?? '')).toBe(200)
  })

  it('reports the same state on a later read', async () => {
    const enabled = await controller.setEnabled(true)

    expect(await controller.get()).toEqual(enabled)
  })

  it('turns the receiver off, hides the token and stops listening', async () => {
    const on = await controller.setEnabled(true)

    const off = await controller.setEnabled(false)

    expect(off).toEqual({ enabled: false, status: 'off', failure: null, port: 0, token: null })
    await expect(accepts(on.port, on.token ?? '')).rejects.toThrow()
  })

  it('keeps the token across an off and on', async () => {
    const first = await controller.setEnabled(true)
    await controller.setEnabled(false)

    expect((await controller.setEnabled(true)).token).toBe(first.token)
  })

  it('reports port-in-use as a failure that keeps the setting on', async () => {
    const holder = build(join(dir, 'holder.json'), 0)
    const held = await holder.controller.setEnabled(true)
    const contender = build(settingsPath, held.port)

    const dto = await contender.controller.setEnabled(true)

    expect(dto).toMatchObject({
      enabled: true,
      status: 'failed',
      failure: 'port-in-use',
      port: held.port
    })
    expect(dto.token).not.toBeNull()
    await holder.stopAll()
  })

  it('does not start the receiver when the setting cannot be saved', async () => {
    const blocker = join(dir, 'blocker')
    writeFileSync(blocker, '')
    const broken = build(join(blocker, 'otel-receiver.json'), 0)

    await expect(broken.controller.setEnabled(true)).rejects.toThrow()

    expect(broken.receiver.state()).toEqual({ status: 'off' })
  })

  it('keeps the server up when turning it off cannot be saved', async () => {
    const folder = join(dir, 'settings')
    mkdirSync(folder)
    const guarded = build(join(folder, 'otel-receiver.json'), 0)
    await guarded.controller.setEnabled(true)
    // A file where the folder was makes the next save fail for any user, root included.
    rmSync(folder, { recursive: true })
    writeFileSync(folder, '')

    await expect(guarded.controller.setEnabled(false)).rejects.toThrow()

    expect(guarded.receiver.state().status).toBe('listening')
    await guarded.stopAll()
  })

  it('reports listening once the saved setting has been started', async () => {
    await settings.setEnabled(true)

    await controller.startFromSettings()

    expect((await controller.get()).status).toBe('listening')
  })

  it('starts from the saved setting when it is on', async () => {
    const saved = await settings.setEnabled(true)

    await controller.startFromSettings()

    const dto = await controller.get()
    expect([dto.status, dto.token]).toEqual(['listening', saved.token])
  })

  it('does not start the server at startup when the saved setting is off', async () => {
    await settings.setEnabled(true)
    await settings.setEnabled(false)

    await controller.startFromSettings()

    expect(receiver.state()).toEqual({ status: 'off' })
  })

  it('does not start the server at startup when nothing was saved', async () => {
    await controller.startFromSettings()

    expect(receiver.state()).toEqual({ status: 'off' })
  })

  it('answers a read made in the same tick as startFromSettings with the receiver listening', async () => {
    let listening = false
    const slowToStart: OtelReceiver = {
      start: async () => {
        await new Promise((resolve) => setTimeout(resolve, 30))
        listening = true
        return { status: 'listening', port: 1 }
      },
      stop: () => Promise.resolve(),
      state: () => (listening ? { status: 'listening', port: 1 } : { status: 'off' })
    }
    const saved: OtelSettingsStore = {
      read: () => Promise.resolve({ enabled: true, token: 'tok' }),
      setEnabled: () => Promise.resolve({ enabled: true, token: 'tok' })
    }
    const launching = createOtelReceiverController({
      settings: saved,
      receiver: slowToStart,
      port: 0
    })

    const [, during] = await Promise.all([launching.startFromSettings(), launching.get()])

    expect(during).toMatchObject({ enabled: true, status: 'listening' })
  })

  it('answers a read made during a change with the state after it', async () => {
    const [, during] = await Promise.all([controller.setEnabled(true), controller.get()])

    expect(during).toMatchObject({ enabled: true, status: 'listening' })
  })

  it('stops listening without changing the saved setting', async () => {
    await controller.setEnabled(true)

    await controller.stop()

    expect((await settings.read()).enabled).toBe(true)
    expect(await controller.get()).toMatchObject({ enabled: true, status: 'off' })
  })

  it('applies overlapping changes in the order they were made, whatever each takes to save', async () => {
    let saved = { enabled: false, token: null as string | null }
    const slowToEnable: OtelSettingsStore = {
      read: () => Promise.resolve(saved),
      setEnabled: async (enabled) => {
        await new Promise((resolve) => setTimeout(resolve, enabled ? 40 : 1))
        saved = { enabled, token: 'tok' }
        return saved
      }
    }
    let listening = false
    const fake: OtelReceiver = {
      start: () => {
        listening = true
        return Promise.resolve({ status: 'listening', port: 1 })
      },
      stop: () => {
        listening = false
        return Promise.resolve()
      },
      state: () => (listening ? { status: 'listening', port: 1 } : { status: 'off' })
    }
    const racing = createOtelReceiverController({ settings: slowToEnable, receiver: fake, port: 0 })

    await Promise.all([racing.setEnabled(true), racing.setEnabled(false)])

    expect([saved.enabled, listening]).toEqual([false, false])
  })
})
