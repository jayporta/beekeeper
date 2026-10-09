import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import { errorCode } from '../../core/shared/errorCode'
import type { OtelBinding } from './otelBinding'
import { createSerialQueue } from './serialQueue'
import { writeFileAtomic } from './writeFileAtomic'

/**
 * The persisted opt-in for the telemetry receiver. While it is on, the token
 * and the port it listened on are saved with it, so the setup lines stay valid
 * across a restart.
 */
export type OtelSettings =
  | { readonly enabled: false }
  | { readonly enabled: true; readonly token: string; readonly port: number }

/** The telemetry receiver's settings file. */
export interface OtelSettingsStore {
  /**
   * Reads the settings.
   *
   * @returns The saved settings, or disabled when the file is missing, isn't
   * valid JSON, or holds anything but a boolean `enabled` and, when enabled, a
   * token of 32 random bytes as base64url and a port from 1 to 65535.
   * @throws When the file exists but can't be read.
   */
  read(): Promise<OtelSettings>

  /**
   * Turns the receiver on and saves the token and port it listens on,
   * replacing any saved before.
   *
   * @param binding - The token and the port the receiver is bound to.
   * @returns The saved settings.
   * @throws When the file or its folder can't be written. The folder is created if missing.
   */
  enable(binding: OtelBinding): Promise<OtelSettings>

  /**
   * Turns the receiver off and clears the saved token and port. Writes nothing
   * when it is already off.
   *
   * @returns The saved settings.
   * @throws When the file can't be written.
   */
  disable(): Promise<OtelSettings>
}

const DISABLED: OtelSettings = { enabled: false }

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)

const portSchema = z.number().int().min(1).max(65535)

const fileSchema = z
  .strictObject({
    enabled: z.boolean(),
    token: tokenSchema.optional(),
    port: portSchema.optional()
  })
  .refine((file) => !file.enabled || (file.token !== undefined && file.port !== undefined))

async function readSettings(filePath: string): Promise<OtelSettings> {
  let text: string
  try {
    text = await readFile(filePath, 'utf8')
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return DISABLED
    throw error
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return DISABLED
  }
  const file = fileSchema.safeParse(json)
  if (!file.success) return DISABLED
  const { enabled, token, port } = file.data
  return enabled && token !== undefined && port !== undefined ? { enabled, token, port } : DISABLED
}

/**
 * Opens the telemetry receiver's settings file. The file is written
 * atomically with an owner-only mode, because it holds the bearer token.
 *
 * @param filePath - The settings file, such as `otel-receiver.json` in the app's data folder.
 * @returns A store over that file. Changes are applied one at a time.
 */
export function createOtelSettingsStore(filePath: string): OtelSettingsStore {
  const serialize = createSerialQueue()

  async function write(next: OtelSettings): Promise<OtelSettings> {
    await mkdir(dirname(filePath), { recursive: true })
    await writeFileAtomic(filePath, JSON.stringify(next))
    return next
  }

  async function disableNow(): Promise<OtelSettings> {
    const current = await readSettings(filePath)
    return current.enabled ? write(DISABLED) : current
  }

  return {
    read: () => readSettings(filePath),
    enable: (binding) =>
      serialize(() => write({ enabled: true, token: binding.token, port: binding.port })),
    disable: () => serialize(disableNow)
  }
}
