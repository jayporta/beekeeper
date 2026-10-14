import type { NumstatEntryDto, WorktreeDiffsDto } from '../../../shared/ipc/worktreeDiffDto'
import { replaceUnprintable } from '../../../core/transcript/replaceUnprintable'
import {
  MAX_DIFF_FILES,
  MAX_UNTRACKED,
  type PaneDiffFile,
  type PaneDiffResult,
  type PaneDiffs
} from './paneDiffs'

function toFile(entry: NumstatEntryDto): PaneDiffFile {
  return {
    path: replaceUnprintable(entry.path),
    oldPath: entry.oldPath === undefined ? null : replaceUnprintable(entry.oldPath),
    added: entry.added,
    deleted: entry.deleted
  }
}

/** What {@link toPaneDiffs} needs. */
interface ToPaneDiffsInput {
  /** The viewed session. */
  readonly sessionId: string
  /** The selected node's key. */
  readonly key: string
  /** The subagent whose entry to take. */
  readonly agentId: string
  /** The service's diffs for the session that holds the subagent. */
  readonly dto: WorktreeDiffsDto
  /** When the diff is stored, in milliseconds since the epoch. */
  readonly nowMs: number
}

/**
 * Takes one agent's entry out of a session's worktree diffs as plain data for
 * `$.state`: every repository-controlled path cleaned, and the file and
 * untracked lists cut with their full counts kept.
 *
 * @param input - The ids, the service's diffs and the time.
 * @returns A `ready` diff. Its `result` is `null` when git isn't usable or the service had no entry for the agent.
 */
export function toPaneDiffs(input: ToPaneDiffsInput): PaneDiffs {
  const { sessionId, key, agentId, dto, nowMs } = input
  const entry = dto.agents.find((agent) => agent.agentId === agentId)
  let result: PaneDiffResult | null = null
  if (dto.git === 'ok' && entry !== undefined) {
    result = entry.result.ok
      ? {
          ok: true,
          uncommitted: entry.result.diff.uncommitted,
          files: entry.result.diff.files.slice(0, MAX_DIFF_FILES).map(toFile),
          fileCount: entry.result.diff.files.length,
          untracked: entry.result.diff.untracked
            .slice(0, MAX_UNTRACKED)
            .map((path) => replaceUnprintable(path)),
          untrackedCount: entry.result.diff.untracked.length
        }
      : { ok: false, code: entry.result.code }
  }
  return {
    sessionId,
    key,
    status: 'ready',
    errorCode: null,
    git: dto.git,
    result,
    refreshedAtMs: nowMs
  }
}
