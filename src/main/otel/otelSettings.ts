import { randomBytes } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import { createSerialQueue } from './serialQueue'
import { writeFileAtomic } from './writeFileAtomic'

/** The persisted opt-in for the telemetry receiver. */
export interface OtelSettings {
  /** Whether the receiver should run. */
  readonly enabled: boolean
  /** The bearer token Claude Code must send, or `null` before the receiver was first enabled. */
  readonly token: string | null
}

/** The telemetry receiver's settings file. */
export interface OtelSettingsStore {
  /**
   * Reads the settings.
   *
   * @returns The saved settings, or disabled with no token when the file is
   * missing, isn't valid JSON, or holds anything but a boolean `enabled` and,
   * when enabled, a token of 32 random bytes as base64url.
   * @throws When the file exists but can't be read.
   */
  read(): Promise<OtelSettings>

  /**
   * Turns the receiver on or off and saves the choice. The first enable
   * creates the token, and later toggles keep it.
   *
   * @param enabled - The new setting.
   * @returns The saved settings.
   * @throws When the file or its folder can't be written. The folder is created if missing.
   */
  setEnabled(enabled: boolean): Promise<OtelSettings>
}

const DISABLED: OtelSettings = { enabled: false, token: null }

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)

const fileSchema = z
  .strictObject({ enabled: z.boolean(), token: tokenSchema.optional() })
  .refine((file) => !file.enabled || file.token !== undefined)

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function readSettings(filePath: string): Promise<OtelSettings> {
  let text: string
  try {
    text = await readFile(filePath, 'utf8')
  } catch (error) {
    if (isMissing(error)) return DISABLED
    throw error
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return DISABLED
  }
  const file = fileSchema.safeParse(json)
  return file.success ? { enabled: file.data.enabled, token: file.data.token ?? null } : DISABLED
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

  async function apply(enabled: boolean): Promise<OtelSettings> {
    const current = await readSettings(filePath)
    if (!enabled && !current.enabled) return current
    const next: OtelSettings = {
      enabled,
      token: current.token ?? (enabled ? randomBytes(32).toString('base64url') : null)
    }
    await mkdir(dirname(filePath), { recursive: true })
    await writeFileAtomic(filePath, JSON.stringify(next))
    return next
  }

  return {
    read: () => readSettings(filePath),
    setEnabled: (enabled) => serialize(() => apply(enabled))
  }
}
