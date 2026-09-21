import { captureSystemError } from '../transcript/captureSystemError'
import { readSubagentMeta } from '../transcript/readSubagentMeta'
import type { SubagentMetaStatus } from './subagentMetaStatus'

/**
 * Resolves one subagent's meta for the agent tree into a
 * {@link SubagentMetaStatus}, so a caller can tell a subagent with no meta
 * file apart from one whose meta exists but couldn't be read or didn't
 * validate. Either way, the subagent still appears in the tree, parented
 * to the lead; the status is for display, not for deciding placement.
 *
 * @param metaPath - The subagent's `.meta.json` path, or `null` when
 * discovery found no meta file for it.
 * @returns `absent` when there's no meta file, `ok` with the validated
 * meta when it read and validated, or `error` with the reason otherwise
 * (including an unexpected read error, reported as `unreadable`).
 */
export async function resolveSubagentMeta(metaPath: string | null): Promise<SubagentMetaStatus> {
  if (metaPath === null) return { status: 'absent' }

  const outcome = await captureSystemError(() => readSubagentMeta(metaPath))
  if (!outcome.ok) return { status: 'error', reason: 'unreadable' }

  return outcome.value.ok
    ? { status: 'ok', meta: outcome.value.value }
    : { status: 'error', reason: outcome.value.error.reason }
}
