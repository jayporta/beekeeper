import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createOtelSettingsStore } from '../otelSettings'
import type { OtelBinding } from '../otelBinding'

let dir = ''
let filePath = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-otel-'))
  filePath = join(dir, 'otel-receiver.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function stored(): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown
}

const TOKEN = 'A'.repeat(43)
const BINDING: OtelBinding = { token: TOKEN, port: 23456 }

describe('createOtelSettingsStore', () => {
  it('reads a missing file as disabled', async () => {
    expect(await createOtelSettingsStore(filePath).read()).toEqual({ enabled: false })
  })

  it.each([
    'not json',
    '[]',
    '{"enabled":"yes"}',
    '{"enabled":true}',
    `{"enabled":true,"token":"${TOKEN}"}`,
    `{"enabled":true,"port":23456}`,
    '{"enabled":true,"token":"short","port":23456}',
    `{"enabled":true,"token":"${TOKEN}","port":0}`,
    `{"enabled":true,"token":"${TOKEN}","port":65536}`,
    `{"enabled":true,"token":"${TOKEN}","port":1.5}`,
    `{"enabled":true,"token":"${TOKEN}","port":"23456"}`
  ])('reads %j as disabled', async (text) => {
    writeFileSync(filePath, text)

    expect(await createOtelSettingsStore(filePath).read()).toEqual({ enabled: false })
  })

  it('reads a disabled file that still holds an old token as disabled with no token', async () => {
    writeFileSync(filePath, `{"enabled":false,"token":"${TOKEN}"}`)

    expect(await createOtelSettingsStore(filePath).read()).toEqual({ enabled: false })
  })

  it('rejects when the file exists but cannot be read', async () => {
    mkdirSync(filePath)

    await expect(createOtelSettingsStore(filePath).read()).rejects.toThrow()
  })

  it('saves the token and port it is enabled with', async () => {
    const settings = await createOtelSettingsStore(filePath).enable(BINDING)

    expect(settings).toEqual({ enabled: true, ...BINDING })
    expect(stored()).toEqual({ enabled: true, token: TOKEN, port: 23456 })
    expect(await createOtelSettingsStore(filePath).read()).toEqual(settings)
  })

  it('replaces the token and port when it is enabled again', async () => {
    const store = createOtelSettingsStore(filePath)
    await store.enable(BINDING)

    const next = { token: 'B'.repeat(43), port: 23457 }
    await store.enable(next)

    expect(await store.read()).toEqual({ enabled: true, ...next })
  })

  it('clears the token and port when it is disabled', async () => {
    const store = createOtelSettingsStore(filePath)
    await store.enable(BINDING)

    const disabled = await store.disable()

    expect(disabled).toEqual({ enabled: false })
    expect(stored()).toEqual({ enabled: false })
  })

  it('writes no file when disabling a receiver that was never enabled', async () => {
    await createOtelSettingsStore(filePath).disable()

    expect(readdirSync(dir)).toEqual([])
  })

  it('writes the file readable by the owner only', async () => {
    await createOtelSettingsStore(filePath).enable(BINDING)

    expect(statSync(filePath).mode & 0o777).toBe(0o600)
  })

  it('narrows the mode of a file that was readable by others', async () => {
    writeFileSync(filePath, '{}', { mode: 0o644 })

    await createOtelSettingsStore(filePath).enable(BINDING)

    expect(statSync(filePath).mode & 0o777).toBe(0o600)
  })

  it('leaves no temporary file behind after a write', async () => {
    const store = createOtelSettingsStore(filePath)
    await store.enable(BINDING)
    await store.disable()

    expect(readdirSync(dir)).toEqual(['otel-receiver.json'])
  })

  it('creates the settings folder when it does not exist', async () => {
    const nested = join(dir, 'deeper', 'still', 'otel-receiver.json')

    await createOtelSettingsStore(nested).enable(BINDING)

    expect(readdirSync(join(dir, 'deeper', 'still'))).toEqual(['otel-receiver.json'])
  })

  it('rejects when the settings folder cannot be created', async () => {
    writeFileSync(join(dir, 'blocker'), '')

    await expect(
      createOtelSettingsStore(join(dir, 'blocker', 'otel-receiver.json')).enable(BINDING)
    ).rejects.toThrow()
  })

  it('applies a change after an earlier one failed', async () => {
    const blocked = join(dir, 'later')
    writeFileSync(blocked, '')
    const store = createOtelSettingsStore(join(blocked, 'otel-receiver.json'))
    await expect(store.enable(BINDING)).rejects.toThrow()
    rmSync(blocked)

    expect((await store.enable(BINDING)).enabled).toBe(true)
  })

  it('keeps the last choice when changes overlap', async () => {
    const store = createOtelSettingsStore(filePath)

    await Promise.all([store.enable(BINDING), store.disable(), store.enable(BINDING)])

    expect(await store.read()).toEqual({ enabled: true, ...BINDING })
  })
})
