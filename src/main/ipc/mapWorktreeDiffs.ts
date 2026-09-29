import type { NumstatEntry } from '../../core/git/parseNumstat'
import type { WorktreeDiffStat } from '../../core/git/worktreeDiffStat'
import type {
  AgentWorktreeDiffDto,
  GitAvailabilityDto,
  NumstatEntryDto,
  SharedWorktreeDto,
  WorktreeDiffsDto,
  WorktreeDiffStatDto
} from '../../shared/ipc/worktreeDiffDto'
import type { AgentWorktreeDiff } from '../git/sessionWorktreeDiffs'
import { mapSessionRef } from './mapSessionRef'

function mapEntry(entry: NumstatEntry): NumstatEntryDto {
  return {
    path: entry.path,
    ...(entry.oldPath === undefined ? {} : { oldPath: entry.oldPath }),
    added: entry.added,
    deleted: entry.deleted
  }
}

function mapStat(stat: WorktreeDiffStat): WorktreeDiffStatDto {
  return {
    uncommitted: stat.uncommitted,
    files: stat.files.map(mapEntry),
    untracked: [...stat.untracked]
  }
}

function mapAgent(agent: AgentWorktreeDiff): AgentWorktreeDiffDto {
  const { result } = agent
  return {
    agentId: agent.agentId,
    inferredBase: agent.inferredBase,
    result: result.ok
      ? { ok: true, diff: mapStat(result.value) }
      : { ok: false, code: result.error }
  }
}

/** Options for {@link mapWorktreeDiffs}. */
export interface MapWorktreeDiffsOptions {
  /** Whether git was usable. */
  readonly git: GitAvailabilityDto
  /** The computed diffs. */
  readonly agents: readonly AgentWorktreeDiff[]
  /** The teammate's shared worktree, or `null`. */
  readonly sharedWorktree: SharedWorktreeDto | null
}

/**
 * Maps a session's worktree diffs onto their transfer shape, copying only
 * the whitelisted fields.
 * @param options - The git availability, the core diffs, and the shared worktree.
 * @returns The DTO.
 */
export function mapWorktreeDiffs(options: MapWorktreeDiffsOptions): WorktreeDiffsDto {
  return {
    git: options.git,
    agents: options.agents.map(mapAgent),
    sharedWorktree:
      options.sharedWorktree === null
        ? null
        : {
            lead: mapSessionRef(options.sharedWorktree.lead),
            agentId: options.sharedWorktree.agentId
          }
  }
}
