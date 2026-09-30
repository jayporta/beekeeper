import { vi, type Mock } from 'vitest'
import type { BeekeeperApi } from '../../shared/ipc/beekeeperApi'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../shared/ipc/projectDto'

/** A parent project folder, for stubbing `listProjects`. */
export function testProject(dirName: string, worktreeOf: string | null = null): ProjectDto {
  return { dirName, worktreeOf }
}

/** The stubbed API: each method is a mock, so a test can assert on calls or change a result. */
export type TestBeekeeperApi = { [K in keyof BeekeeperApi]: Mock<BeekeeperApi[K]> }

/**
 * Installs a stub `window.beekeeper`. `listProjects` returns one project by
 * default. Calls to a method the test did not stub reject, so a test can't
 * silently depend on it.
 *
 * @param overrides - Implementations to use instead of the defaults.
 * @returns The installed stub.
 */
export function installBeekeeperApi(overrides: Partial<BeekeeperApi> = {}): TestBeekeeperApi {
  const unstubbed = (name: string) => () =>
    Promise.reject(new Error(`window.beekeeper.${name} was not stubbed`))
  const api: TestBeekeeperApi = {
    listProjects: vi.fn(
      overrides.listProjects ??
        ((): Promise<IpcResult<readonly ProjectDto[]>> =>
          Promise.resolve({ ok: true, value: [testProject('-Users-a-repo')] }))
    ),
    listSessions: vi.fn(overrides.listSessions ?? unstubbed('listSessions')),
    getSession: vi.fn(overrides.getSession ?? unstubbed('getSession')),
    getWorktreeDiffs: vi.fn(overrides.getWorktreeDiffs ?? unstubbed('getWorktreeDiffs'))
  }
  window.beekeeper = api
  return api
}
