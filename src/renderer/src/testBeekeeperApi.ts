import { vi, type Mock } from 'vitest'
import type { BeekeeperApi } from '../../shared/ipc/beekeeperApi'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../shared/ipc/projectDto'

/** What makes a test project a worktree: the folder it belongs to and its name. Set together or not at all. */
export interface TestWorktree {
  /** The name of the folder this one is a worktree of. */
  readonly worktreeOf: string
  /** The worktree's name, as the app reports it. */
  readonly worktreeName: string
}

/**
 * A project folder, for stubbing `listProjects`.
 *
 * @param dirName - The folder's name under `~/.claude/projects`.
 * @param worktree - Set when the folder is a worktree of another listed folder. Omit it for a top-level project.
 * @returns The project, with no label.
 */
export function testProject(dirName: string, worktree?: TestWorktree): ProjectDto {
  return {
    dirName,
    label: null,
    worktreeOf: worktree?.worktreeOf ?? null,
    worktreeName: worktree?.worktreeName ?? null
  }
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
    getWorktreeDiffs: vi.fn(overrides.getWorktreeDiffs ?? unstubbed('getWorktreeDiffs')),
    getProjectTotals: vi.fn(overrides.getProjectTotals ?? unstubbed('getProjectTotals')),
    getWorktreePatch: vi.fn(overrides.getWorktreePatch ?? unstubbed('getWorktreePatch'))
  }
  window.beekeeper = api
  return api
}
