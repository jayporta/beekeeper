import type { NumstatEntry } from '../../core/git/parseNumstat'
import type { WorktreeDiffStat } from '../../core/git/worktreeDiffStat'
import type {
  AgentWorktreeDiffDto,
  GitAvailabilityDto,
  NumstatEntryDto,
  WorktreeDiffsDto,
  WorktreeDiffStatDto
} from '../../shared/ipc/worktreeDiffDto'
import type { AgentWorktreeDiff } from '../git/sessionWorktreeDiffs'

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
}

/**
 * Maps a session's worktree diffs onto their transfer shape, copying only
 * the whitelisted fields.
 * @param options - The git availability and the core diffs.
 * @returns The DTO.
 */
export function mapWorktreeDiffs(options: MapWorktreeDiffsOptions): WorktreeDiffsDto {
  return { git: options.git, agents: options.agents.map(mapAgent) }
}
