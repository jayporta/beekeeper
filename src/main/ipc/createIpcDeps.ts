import { join } from 'node:path'
import { createServiceDeps } from '../../service/createServiceDeps'
import type { IpcDeps } from './ipcDeps'

/**
 * Builds the handlers' dependencies for the app's lifetime: the services'
 * dependencies for the projects root under the user's home, with no telemetry
 * receiver and no clipboard writer.
 *
 * The telemetry receiver, the clipboard writer and the archive are `null`; the app supplies them.
 *
 * @param homeDir - The user's home directory.
 * @returns The dependencies.
 */
export function createIpcDeps(homeDir: string): IpcDeps {
  return {
    ...createServiceDeps(join(homeDir, '.claude', 'projects')),
    otel: null,
    copyToClipboard: null
  }
}
