import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { freePort } from '../testFreePort'
import { sendToReceiver } from '../testOtelClient'
import { wireOtelReceiver, type OtelReceiverHost } from '../wireOtelReceiver'

const TOKEN = 'A'.repeat(43)

let dir = ''
let settingsPath = ''
let quit: () => void = () => undefined
const host: OtelReceiverHost = {
  onWillQuit: (listener) => {
    quit = listener
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-otel-wire-'))
  settingsPath = join(dir, 'otel-receiver.json')
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(dir, { recursive: true, force: true })
})

const isListening = (port: number): Promise<boolean> =>
  sendToReceiver({ port, body: '{}', headers: { authorization: `Bearer ${TOKEN}` } }).then(
    () => true,
    () => false
  )

describe('wireOtelReceiver', () => {
  it('starts the receiver on the saved port when the saved setting is on', async () => {
    const port = await freePort()
    writeFileSync(settingsPath, JSON.stringify({ enabled: true, token: TOKEN, port }))

    const otel = wireOtelReceiver({ settingsPath, host })

    expect(await otel.receiver.get()).toMatchObject({ enabled: true, status: 'listening', port })
    quit()
    await otel.receiver.get()
  })

  it('leaves the receiver off when nothing was saved', async () => {
    const otel = wireOtelReceiver({ settingsPath, host })

    expect(await otel.receiver.get()).toEqual({ enabled: false, status: 'off', failure: null })
  })

  it('stops the receiver when the app quits', async () => {
    const port = await freePort()
    writeFileSync(settingsPath, JSON.stringify({ enabled: true, token: TOKEN, port }))
    const otel = wireOtelReceiver({ settingsPath, host })
    await otel.receiver.get()

    quit()
    await otel.receiver.get()

    expect(await isListening(port)).toBe(false)
  })

  it('does not stop the receiver before the app quits', async () => {
    const port = await freePort()
    writeFileSync(settingsPath, JSON.stringify({ enabled: true, token: TOKEN, port }))
    const otel = wireOtelReceiver({ settingsPath, host })
    await otel.receiver.get()

    expect(await isListening(port)).toBe(true)
    quit()
    await otel.receiver.get()
  })

  it('logs a start that fails by its name, never its message, and keeps running', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    // A folder where the settings file should be makes reading it fail.
    writeFileSync(join(dir, 'blocker'), '')

    const otel = wireOtelReceiver({
      settingsPath: join(dir, 'blocker', 'otel-receiver.json'),
      host
    })
    await otel.receiver.get().catch(() => undefined)

    expect(log).toHaveBeenCalledWith('Beekeeper could not start the telemetry receiver (ENOTDIR).')
  })
})
