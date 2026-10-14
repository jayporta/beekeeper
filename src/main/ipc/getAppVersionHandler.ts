import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'

/**
 * Reads the version of the running app.
 *
 * @param deps - The app version, which is `null` when the app didn't set one up.
 * @returns The version, or `internal` when there is none.
 */
export async function getAppVersionHandler(
  deps: Pick<IpcDeps, 'appVersion'>
): Promise<IpcResult<string>> {
  if (deps.appVersion === null) return errResult('internal')
  return okResult(deps.appVersion)
}
