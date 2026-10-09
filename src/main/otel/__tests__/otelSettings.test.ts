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

describe('createOtelSettingsStore', () => {
  it('reads a missing file as disabled with no token', async () => {
    expect(await createOtelSettingsStore(filePath).read()).toEqual({ enabled: false, token: null })
  })

  it.each([
    'not json',
    '[]',
    '{"enabled":"yes"}',
    '{"enabled":true}',
    '{"enabled":true,"token":"short"}'
  ])('reads %j as disabled with no token', async (text) => {
    writeFileSync(filePath, text)

    expect(await createOtelSettingsStore(filePath).read()).toEqual({ enabled: false, token: null })
  })

  it('rejects when the file exists but cannot be read', async () => {
    mkdirSync(filePath)

    await expect(createOtelSettingsStore(filePath).read()).rejects.toThrow()
  })

  it('creates a 32-byte base64url token the first time it is enabled', async () => {
    const settings = await createOtelSettingsStore(filePath).setEnabled(true)

    expect(settings.enabled).toBe(true)
    expect(settings.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('persists the enabled flag and token', async () => {
    const settings = await createOtelSettingsStore(filePath).setEnabled(true)

    expect(stored()).toEqual({ enabled: true, token: settings.token })
    expect(await createOtelSettingsStore(filePath).read()).toEqual(settings)
  })

  it('keeps the same token across a disable and a re-enable', async () => {
    const store = createOtelSettingsStore(filePath)
    const first = await store.setEnabled(true)

    const disabled = await store.setEnabled(false)
    const again = await store.setEnabled(true)

    expect([disabled.enabled, disabled.token, again.token]).toEqual([
      false,
      first.token,
      first.token
    ])
  })

  it('creates a different token for a different install', async () => {
    const other = join(dir, 'other.json')

    const a = await createOtelSettingsStore(filePath).setEnabled(true)
    const b = await createOtelSettingsStore(other).setEnabled(true)

    expect(a.token).not.toBe(b.token)
  })

  it('writes no file when disabling a receiver that was never enabled', async () => {
    await createOtelSettingsStore(filePath).setEnabled(false)

    expect(readdirSync(dir)).toEqual([])
  })

  it('writes the file readable by the owner only', async () => {
    await createOtelSettingsStore(filePath).setEnabled(true)

    expect(statSync(filePath).mode & 0o777).toBe(0o600)
  })

  it('narrows the mode of a file that was readable by others', async () => {
    writeFileSync(filePath, '{}', { mode: 0o644 })

    await createOtelSettingsStore(filePath).setEnabled(true)

    expect(statSync(filePath).mode & 0o777).toBe(0o600)
  })

  it('leaves no temporary file behind after a write', async () => {
    const store = createOtelSettingsStore(filePath)
    await store.setEnabled(true)
    await store.setEnabled(false)

    expect(readdirSync(dir)).toEqual(['otel-receiver.json'])
  })

  it('rejects when the settings folder does not exist', async () => {
    const missing = join(dir, 'missing', 'otel-receiver.json')

    await expect(createOtelSettingsStore(missing).setEnabled(true)).rejects.toThrow()
  })

  it('applies a change after an earlier one failed', async () => {
    const nested = join(dir, 'later', 'otel-receiver.json')
    const store = createOtelSettingsStore(nested)
    await expect(store.setEnabled(true)).rejects.toThrow()
    mkdirSync(join(dir, 'later'))

    expect((await store.setEnabled(true)).enabled).toBe(true)
  })

  it('creates one token when enables overlap', async () => {
    const store = createOtelSettingsStore(filePath)

    const [a, b] = await Promise.all([store.setEnabled(true), store.setEnabled(true)])

    expect([a?.token, (await store.read()).token]).toEqual([b?.token, b?.token])
  })

  it('keeps the last choice when toggles overlap', async () => {
    const store = createOtelSettingsStore(filePath)

    await Promise.all([store.setEnabled(true), store.setEnabled(false), store.setEnabled(true)])

    expect((await store.read()).enabled).toBe(true)
  })
})
