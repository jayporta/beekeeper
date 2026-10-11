import { registerServiceTestTree, type ServiceTestTree } from '../../service/testServiceTree'
import type { IpcDeps } from './ipcDeps'

/** The current test's synthetic tree and the handler dependencies rooted at it. */
export interface IpcTestContext {
  /** The current test's tree. */
  readonly tree: ServiceTestTree
  /** Handler dependencies whose home is the current test's tree, with no telemetry receiver and no clipboard. */
  readonly deps: IpcDeps
}

/**
 * Builds a fresh {@link ServiceTestTree} and matching {@link IpcDeps} before
 * each test in the calling file, and removes the tree after it.
 * @returns Getters for the current test's tree and deps.
 * @throws {Error} When a getter is read outside a running test.
 */
export function registerIpcTestTree(): IpcTestContext {
  const service = registerServiceTestTree()
  return {
    get tree() {
      return service.tree
    },
    get deps() {
      return { ...service.deps, otel: null, copyToClipboard: null }
    }
  }
}
