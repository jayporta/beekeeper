import { vi, type Mock } from 'vitest'
import type { BeekeeperApi } from '../../shared/ipc/beekeeperApi'
import type { FilesChangedDto } from '../../shared/ipc/filesChangedDto'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { OtelReceiverDto } from '../../shared/ipc/otelReceiverDto'
import type { ProjectDto } from '../../shared/ipc/projectDto'

/** A telemetry receiver that is off, which is what an unstubbed `getOtelReceiver` reports. */
export const TEST_OTEL_OFF: OtelReceiverDto = { enabled: false, status: 'off', failure: null }

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
export type TestBeekeeperApi = { [K in keyof BeekeeperApi]: Mock<BeekeeperApi[K]> } & {
  /** Calls every listener subscribed through `onOpenAbout`, as the menu's About item does. */
  fireOpenAbout(): void
  /** Calls every listener subscribed through `onFilesChanged` with `change`, as a batch from the main process does. */
  fireFilesChanged(change: FilesChangedDto): void
  /**
   * Calls every listener subscribed through `onLiveUpdatesUnavailable`, as the main process does when the watcher fails.
   * With no listener it is remembered once, and the first `onLiveUpdatesUnavailable` subscriber gets it at once.
   */
  fireLiveUpdatesUnavailable(): void
}

/**
 * A set of listeners that `subscribe` adds to and the returned function removes from.
 *
 * @param holdEarlySignal - When set, a `fire` that finds no listener is remembered once (several count as one), and the first listener to subscribe is called with it at once, as the preload's signal relay does.
 */
function createListeners<T extends unknown[]>(
  holdEarlySignal = false
): {
  subscribe(listener: (...args: T) => void): () => void
  fire(...args: T): void
} {
  const listeners = new Set<(...args: T) => void>()
  let pending: T | undefined
  return {
    subscribe: (listener) => {
      listeners.add(listener)
      if (pending) {
        const args = pending
        pending = undefined
        listener(...args)
      }
      return () => {
        listeners.delete(listener)
      }
    },
    fire: (...args) => {
      if (holdEarlySignal && listeners.size === 0) {
        pending = args
        return
      }
      for (const listener of [...listeners]) listener(...args)
    }
  }
}

/**
 * Installs a stub `window.beekeeper`. `listProjects` returns one project by
 * default, and `getOtelReceiver` reports an off receiver, since the sidebar
 * reads it. Calls to any other method the test did not stub reject, so a test
 * can't silently depend on it. `onOpenAbout`, `onFilesChanged` and
 * `onLiveUpdatesUnavailable` subscriptions are real: each `fire…` helper reaches
 * every listener that has not unsubscribed. As in the preload, a
 * `fireOpenAbout` or `fireLiveUpdatesUnavailable` before any subscriber is held
 * for the first one.
 *
 * @param overrides - Implementations to use instead of the defaults.
 * @returns The installed stub.
 */
export function installBeekeeperApi(overrides: Partial<BeekeeperApi> = {}): TestBeekeeperApi {
  const unstubbed = (name: string) => () =>
    Promise.reject(new Error(`window.beekeeper.${name} was not stubbed`))
  const about = createListeners(true)
  const filesChanged = createListeners<[FilesChangedDto]>()
  const unavailable = createListeners(true)
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
    getProjectDailyUsage: vi.fn(
      overrides.getProjectDailyUsage ?? ((): Promise<never> => new Promise(() => undefined))
    ),
    getWorktreePatch: vi.fn(overrides.getWorktreePatch ?? unstubbed('getWorktreePatch')),
    getOtelReceiver: vi.fn(
      overrides.getOtelReceiver ??
        ((): Promise<IpcResult<OtelReceiverDto>> =>
          Promise.resolve({ ok: true, value: TEST_OTEL_OFF }))
    ),
    setOtelReceiverEnabled: vi.fn(
      overrides.setOtelReceiverEnabled ?? unstubbed('setOtelReceiverEnabled')
    ),
    getReportedCost: vi.fn(overrides.getReportedCost ?? unstubbed('getReportedCost')),
    copyText: vi.fn(overrides.copyText ?? unstubbed('copyText')),
    onOpenAbout: vi.fn(overrides.onOpenAbout ?? about.subscribe),
    onFilesChanged: vi.fn(overrides.onFilesChanged ?? filesChanged.subscribe),
    onLiveUpdatesUnavailable: vi.fn(overrides.onLiveUpdatesUnavailable ?? unavailable.subscribe),
    fireOpenAbout: about.fire,
    fireFilesChanged: filesChanged.fire,
    fireLiveUpdatesUnavailable: unavailable.fire
  }
  window.beekeeper = api
  return api
}
