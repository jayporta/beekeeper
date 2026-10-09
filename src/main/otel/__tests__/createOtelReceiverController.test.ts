import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createOtelReceiver, type OtelReceiver } from '../createOtelReceiver'
import {
  createOtelReceiverController,
  type OtelReceiverController
} from '../createOtelReceiverController'
import { createReportedCostStore, type ReportedCostStore } from '../createReportedCostStore'
import { createOtelSettingsStore, type OtelSettingsStore } from '../otelSettings'
import { freePort } from '../testFreePort'
import { sendToReceiver } from '../testOtelClient'
import { apiRequestAttributes, logRecord, otlpLogsBody, TEST_SESSION_ID } from '../testOtlpLogs'

const TOKEN_A = 'A'.repeat(43)
const TOKEN_B = 'B'.repeat(43)
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

let dir = ''
let settingsPath = ''
let built: Built

interface Built {
  controller: OtelReceiverController
  settings: OtelSettingsStore
  receiver: OtelReceiver
  costs: ReportedCostStore
  stopAll: () => Promise<void>
}

interface BuildOptions {
  readonly pickPort?: () => number
  readonly tokens?: readonly string[]
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-otel-controller-'))
  settingsPath = join(dir, 'otel-receiver.json')
  built = build(settingsPath)
})

afterEach(async () => {
  await built.stopAll()
  rmSync(dir, { recursive: true, force: true })
})

function build(path: string, { pickPort = () => 0, tokens = [] }: BuildOptions = {}): Built {
  const settings = createOtelSettingsStore(path)
  const costs = createReportedCostStore()
  const receiver = createOtelReceiver({ costs })
  let issued = 0
  const controller = createOtelReceiverController({
    settings,
    receiver,
    costs,
    pickPort,
    newToken: () => tokens[issued++] ?? `T${String(issued).padStart(42, '0')}`
  })
  return { controller, settings, receiver, costs, stopAll: () => controller.stop() }
}

/** A picker that returns the given ports in order, then repeats the last one. */
function ports(...list: number[]): { pick: () => number; calls: () => number } {
  let calls = 0
  return {
    pick: () => list[Math.min(calls++, list.length - 1)] ?? 0,
    calls: () => calls
  }
}

const accepts = async (port: number, token: string): Promise<number> =>
  (
    await sendToReceiver({
      port,
      body: JSON.stringify(otlpLogsBody([logRecord(apiRequestAttributes())])),
      headers: { authorization: `Bearer ${token}` }
    })
  ).status

const refused = (port: number, token: string): Promise<boolean> =>
  accepts(port, token).then(
    () => false,
    () => true
  )

/** Starts a receiver that holds a port, as another process would. */
async function holdPort(): Promise<{ port: number; release: () => Promise<void> }> {
  const holder = build(join(dir, 'holder.json'))
  const dto = await holder.controller.setEnabled(true)
  if (!dto.enabled) throw new Error('the holder did not start')
  return { port: dto.port, release: holder.stopAll }
}

function onDto(dto: Awaited<ReturnType<OtelReceiverController['get']>>): {
  port: number
  token: string
} {
  if (!dto.enabled) throw new Error('the receiver is off')
  return { port: dto.port, token: dto.token }
}

describe('createOtelReceiverController turning on', () => {
  it('reports an off receiver before anything is turned on', async () => {
    expect(await built.controller.get()).toEqual({ enabled: false, status: 'off', failure: null })
  })

  it('turns the receiver on, listening, with a token and a port that accept reports', async () => {
    const dto = await built.controller.setEnabled(true)

    expect(dto).toMatchObject({ enabled: true, status: 'listening', failure: null })
    const { port, token } = onDto(dto)
    expect(token).toMatch(TOKEN_PATTERN)
    expect(port).toBeGreaterThan(0)
    expect(await accepts(port, token)).toBe(200)
  })

  it('saves the port the server bound, not the one it was asked for', async () => {
    const { port, token } = onDto(await built.controller.setEnabled(true))

    expect(await built.settings.read()).toEqual({ enabled: true, token, port })
  })

  it('picks the port to bind with the picker', async () => {
    const wanted = await freePort()
    const custom = build(join(dir, 'custom.json'), { pickPort: () => wanted })

    const dto = await custom.controller.setEnabled(true)

    expect(onDto(dto).port).toBe(wanted)
    await custom.stopAll()
  })

  it('reports the same state on a later read', async () => {
    const enabled = await built.controller.setEnabled(true)

    expect(await built.controller.get()).toEqual(enabled)
  })

  it('keeps the port and token when turned on while already on', async () => {
    const picker = ports(0)
    const again = build(join(dir, 'again.json'), { pickPort: picker.pick, tokens: [TOKEN_A] })
    const first = await again.controller.setEnabled(true)

    const second = await again.controller.setEnabled(true)

    expect([second, picker.calls()]).toEqual([first, 1])
    await again.stopAll()
  })

  it('replaces a server still listening under another token when the saved setting is off', async () => {
    const stale = build(join(dir, 'stale.json'), { tokens: [TOKEN_B] })
    const old = await stale.receiver.start({ token: TOKEN_A, port: 0 })
    if (old.status !== 'listening') throw new Error('the stale server did not start')

    const dto = await stale.controller.setEnabled(true)

    const { port, token } = onDto(dto)
    expect(token).toBe(TOKEN_B)
    expect(await accepts(port, TOKEN_B)).toBe(200)
    expect(await accepts(port, TOKEN_A)).toBe(401)
    await stale.stopAll()
  })

  it('issues a new port and a new token each time it is turned off and on', async () => {
    const [first, second] = [await freePort(), await freePort()]
    const picker = ports(first, second)
    const rotating = build(join(dir, 'rotating.json'), {
      pickPort: picker.pick,
      tokens: [TOKEN_A, TOKEN_B]
    })
    const on = onDto(await rotating.controller.setEnabled(true))
    await rotating.controller.setEnabled(false)

    const again = onDto(await rotating.controller.setEnabled(true))

    expect([on, again]).toEqual([
      { port: first, token: TOKEN_A },
      { port: second, token: TOKEN_B }
    ])
    expect(await accepts(again.port, TOKEN_A)).toBe(401)
    expect(await accepts(again.port, TOKEN_B)).toBe(200)
    expect(await refused(on.port, TOKEN_A)).toBe(true)
    await rotating.stopAll()
  })
})

describe('createOtelReceiverController when no port can be bound', () => {
  it('retries a port that is in use and listens on the next one it picks', async () => {
    const held = await holdPort()
    const free = await freePort()
    const picker = ports(held.port, held.port, free)
    const retrying = build(join(dir, 'retrying.json'), { pickPort: picker.pick })

    const dto = await retrying.controller.setEnabled(true)

    expect([onDto(dto).port, picker.calls()]).toEqual([free, 3])
    await retrying.stopAll()
    await held.release()
  })

  it('gives up after the attempt cap, saves nothing and reports why', async () => {
    const held = await holdPort()
    const picker = ports(held.port)
    const stuck = build(join(dir, 'stuck.json'), { pickPort: picker.pick })

    const dto = await stuck.controller.setEnabled(true)

    expect(dto).toEqual({ enabled: false, status: 'failed', failure: 'port-in-use' })
    expect(picker.calls()).toBe(5)
    expect(await stuck.settings.read()).toEqual({ enabled: false })
    expect(stuck.receiver.state().status).not.toBe('listening')
    await held.release()
  })

  it('keeps reporting the failure on a read until the next change', async () => {
    const held = await holdPort()
    const stuck = build(join(dir, 'stuck.json'), { pickPort: ports(held.port).pick })
    await stuck.controller.setEnabled(true)

    const read = await stuck.controller.get()
    const cleared = await stuck.controller.setEnabled(false)

    expect(read).toEqual({ enabled: false, status: 'failed', failure: 'port-in-use' })
    expect(cleared).toEqual({ enabled: false, status: 'off', failure: null })
    await held.release()
  })

  it('clears the failure when a later attempt succeeds', async () => {
    const held = await holdPort()
    const free = await freePort()
    let useHeld = true
    const flaky = build(join(dir, 'flaky.json'), { pickPort: () => (useHeld ? held.port : free) })
    await flaky.controller.setEnabled(true)
    useHeld = false

    const dto = await flaky.controller.setEnabled(true)

    expect(dto).toMatchObject({ enabled: true, status: 'listening', failure: null, port: free })
    await flaky.stopAll()
    await held.release()
  })

  it('does not retry a failure that is not a port in use', async () => {
    const picker = ports(70000)
    const invalid = build(join(dir, 'invalid.json'), { pickPort: picker.pick })

    const dto = await invalid.controller.setEnabled(true)

    expect(dto).toEqual({ enabled: false, status: 'failed', failure: 'failed' })
    expect(picker.calls()).toBe(1)
  })
})

/** A settings store that is off and can't be written, as a full disk would be. */
function unwritableSettings(): OtelSettingsStore {
  return {
    read: () => Promise.resolve({ enabled: false }),
    enable: () => Promise.reject(new Error('disk full')),
    disable: () => Promise.reject(new Error('disk full'))
  }
}

describe('createOtelReceiverController saving', () => {
  it('stops the server and throws when the bound port cannot be saved', async () => {
    const receiver = createOtelReceiver({ costs: createReportedCostStore() })
    const broken = createOtelReceiverController({
      settings: unwritableSettings(),
      receiver,
      costs: createReportedCostStore(),
      pickPort: () => 0
    })

    await expect(broken.setEnabled(true)).rejects.toThrow('disk full')

    expect(receiver.state()).toEqual({ status: 'off' })
    expect(await broken.get()).toEqual({ enabled: false, status: 'off', failure: null })
  })

  it('frees the port when the bound port cannot be saved', async () => {
    const port = await freePort()
    const broken = createOtelReceiverController({
      settings: unwritableSettings(),
      receiver: createOtelReceiver({ costs: createReportedCostStore() }),
      costs: createReportedCostStore(),
      pickPort: () => port
    })

    await expect(broken.setEnabled(true)).rejects.toThrow('disk full')

    expect(await refused(port, TOKEN_A)).toBe(true)
  })

  it('binds before it saves', async () => {
    const held = await holdPort()
    const stuck = build(join(dir, 'stuck.json'), { pickPort: ports(held.port).pick })

    await stuck.controller.setEnabled(true)

    expect((await stuck.settings.read()).enabled).toBe(false)
    await held.release()
  })
})

describe('createOtelReceiverController turning off', () => {
  it('turns the receiver off, drops the token and port, and stops listening', async () => {
    const on = onDto(await built.controller.setEnabled(true))

    const off = await built.controller.setEnabled(false)

    expect(off).toEqual({ enabled: false, status: 'off', failure: null })
    expect(await built.settings.read()).toEqual({ enabled: false })
    expect(await refused(on.port, on.token)).toBe(true)
  })

  it('forgets the costs it was sent', async () => {
    await built.controller.setEnabled(true)
    built.costs.record([
      {
        sessionId: TEST_SESSION_ID,
        costUsd: 1,
        inputTokens: 1,
        outputTokens: 1,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        model: null,
        agentId: null,
        requestId: null
      }
    ])

    await built.controller.setEnabled(false)

    expect(built.costs.get(TEST_SESSION_ID)).toBeNull()
  })

  it('keeps the server up when turning it off cannot be saved', async () => {
    const folder = join(dir, 'settings')
    mkdirSync(folder)
    const guarded = build(join(folder, 'otel-receiver.json'))
    await guarded.controller.setEnabled(true)
    // A file where the folder was makes the next save fail for any user, root included.
    rmSync(folder, { recursive: true })
    writeFileSync(folder, '')

    await expect(guarded.controller.setEnabled(false)).rejects.toThrow()

    expect(guarded.receiver.state().status).toBe('listening')
    await guarded.stopAll()
  })
})

describe('createOtelReceiverController at launch', () => {
  it('starts on the saved port and token when the saved setting is on', async () => {
    const port = await freePort()
    await built.settings.enable({ token: TOKEN_A, port })

    await built.controller.startFromSettings()

    expect(await built.controller.get()).toEqual({
      enabled: true,
      status: 'listening',
      failure: null,
      port,
      token: TOKEN_A
    })
    expect(await accepts(port, TOKEN_A)).toBe(200)
  })

  it('reports port-in-use on the saved port without picking another', async () => {
    const held = await holdPort()
    const picker = ports(0)
    const launching = build(join(dir, 'launching.json'), { pickPort: picker.pick })
    await launching.settings.enable({ token: TOKEN_A, port: held.port })

    await launching.controller.startFromSettings()

    expect(await launching.controller.get()).toEqual({
      enabled: true,
      status: 'failed',
      failure: 'port-in-use',
      port: held.port,
      token: TOKEN_A
    })
    expect(picker.calls()).toBe(0)
    expect(await launching.settings.read()).toEqual({
      enabled: true,
      token: TOKEN_A,
      port: held.port
    })
    await held.release()
  })

  it('does not start the server when the saved setting is off', async () => {
    await built.settings.enable({ token: TOKEN_A, port: await freePort() })
    await built.settings.disable()

    await built.controller.startFromSettings()

    expect(built.receiver.state()).toEqual({ status: 'off' })
  })

  it('does not start the server when nothing was saved', async () => {
    await built.controller.startFromSettings()

    expect(built.receiver.state()).toEqual({ status: 'off' })
  })

  it('treats a saved setting that is on with a token and no port as off', async () => {
    writeFileSync(settingsPath, JSON.stringify({ enabled: true, token: TOKEN_A }))

    await built.controller.startFromSettings()

    expect(built.receiver.state()).toEqual({ status: 'off' })
    expect(await built.controller.get()).toEqual({ enabled: false, status: 'off', failure: null })
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
      read: () => Promise.resolve({ enabled: true, token: 'tok', port: 1 }),
      enable: () => Promise.resolve({ enabled: true, token: 'tok', port: 1 }),
      disable: () => Promise.resolve({ enabled: false })
    }
    const launching = createOtelReceiverController({
      settings: saved,
      receiver: slowToStart,
      costs: createReportedCostStore()
    })

    const [, during] = await Promise.all([launching.startFromSettings(), launching.get()])

    expect(during).toMatchObject({ enabled: true, status: 'listening' })
  })

  it('answers a read made during a change with the state after it', async () => {
    const [, during] = await Promise.all([
      built.controller.setEnabled(true),
      built.controller.get()
    ])

    expect(during).toMatchObject({ enabled: true, status: 'listening' })
  })

  it('stops listening without changing the saved setting', async () => {
    await built.controller.setEnabled(true)

    await built.controller.stop()

    expect((await built.settings.read()).enabled).toBe(true)
    expect(await built.controller.get()).toMatchObject({ enabled: true, status: 'failed' })
  })
})

describe('createOtelReceiverController ordering', () => {
  it('applies overlapping changes in the order they were made, whatever each takes to save', async () => {
    let saved: Awaited<ReturnType<OtelSettingsStore['read']>> = { enabled: false }
    const slowToEnable: OtelSettingsStore = {
      read: () => Promise.resolve(saved),
      enable: async (binding) => {
        await new Promise((resolve) => setTimeout(resolve, 40))
        saved = { enabled: true, ...binding }
        return saved
      },
      disable: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        saved = { enabled: false }
        return saved
      }
    }
    let listening = false
    const fake: OtelReceiver = {
      start: ({ port }) => {
        listening = true
        return Promise.resolve({ status: 'listening', port })
      },
      stop: () => {
        listening = false
        return Promise.resolve()
      },
      state: () => (listening ? { status: 'listening', port: 1 } : { status: 'off' })
    }
    const racing = createOtelReceiverController({
      settings: slowToEnable,
      receiver: fake,
      costs: createReportedCostStore(),
      pickPort: () => 1
    })

    await Promise.all([racing.setEnabled(true), racing.setEnabled(false)])

    expect([saved.enabled, listening]).toEqual([false, false])
  })
})
