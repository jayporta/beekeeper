import type { SessionEntry } from '../../core/transcript/discoverSessions'
import { distinctRunIds } from './distinctRunIds'
import type { IpcDeps } from './ipcDeps'

/** The workflow run names of a session that has none. */
export const NO_WORKFLOW_RUN_NAMES: readonly string[] = []

/**
 * Reads the names of a session's workflow runs through the run names cache,
 * under the summaries scheduler. A session whose transcript couldn't be read,
 * whose subagents couldn't be listed, or with no workflow runs, has none and
 * costs no scheduler turn.
 *
 * @param entry - The session, as discovery found it.
 * @param deps - The run names cache and the summaries scheduler.
 * @returns The session's distinct run names, in run id order.
 */
export function readSessionWorkflowRunNames(
  entry: SessionEntry,
  deps: Pick<IpcDeps, 'workflowRunNames' | 'summaries'>
): Promise<readonly string[]> {
  if (!entry.transcript.ok || !entry.subagents.ok) {
    return Promise.resolve(NO_WORKFLOW_RUN_NAMES)
  }
  const runIds = distinctRunIds(entry.subagents.value)
  if (runIds.length === 0) return Promise.resolve(NO_WORKFLOW_RUN_NAMES)

  const { sessionDir } = entry
  return deps.summaries.run(`runNames\0${sessionDir}\0${runIds.join('\0')}`, () =>
    deps.workflowRunNames.read({ sessionDir, runIds })
  )
}
