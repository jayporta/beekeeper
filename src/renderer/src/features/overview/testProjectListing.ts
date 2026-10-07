import type { IpcResult } from '../../../../shared/ipc/ipcResult'
import { testProject } from '@renderer/testBeekeeperApi'

/** A `listProjects` stub that resolves with one top-level project for each folder name. */
export const listing =
  (...dirs: string[]): (() => Promise<IpcResult<ReturnType<typeof testProject>[]>>) =>
  () =>
    Promise.resolve({ ok: true, value: dirs.map((dir) => testProject(dir)) })
