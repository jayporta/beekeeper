import type { SessionRefDto } from './sessionRefDto'

/** Whether git was usable: found and new enough, or why not. */
export type GitAvailabilityDto = 'ok' | 'git-not-found' | 'git-too-old'

/** How uncommitted work was handled in a worktree diff. */
export type UncommittedStatusDto =
  'included' | 'no-worktree' | 'skipped-filters' | 'worktree-mismatch'

/**
 * Why one agent's worktree diff is unavailable. `too-many-agents` marks an
 * agent past the per-request cap on worktree agents, in tree order, whose
 * diff was not attempted.
 */
export type WorktreeDiffCodeDto =
  | 'invalid-ref'
  | 'invalid-path'
  | 'branch-not-found'
  | 'git-failed'
  | 'no-common-ancestor'
  | 'malformed-numstat'
  | 'output-too-large'
  | 'timeout'
  | 'spawn-failed'
  | 'repo-missing'
  | 'not-a-repo'
  | 'outside-project'
  | 'no-base'
  | 'too-many-agents'

/** One changed file's line counts. */
export interface NumstatEntryDto {
  /** The file's path, or its new path for a rename. Repo-controlled: render as plain text only. */
  readonly path: string
  /** The path before a rename. Repo-controlled: render as plain text only. */
  readonly oldPath?: string
  /** Lines added, or `null` for a binary file. */
  readonly added: number | null
  /** Lines deleted, or `null` for a binary file. */
  readonly deleted: number | null
}

/** What an agent's branch changed relative to where it diverged from its base. */
export interface WorktreeDiffStatDto {
  /** Whether the files include uncommitted work, and why not when they don't. */
  readonly uncommitted: UncommittedStatusDto
  /** Changed tracked files with their line counts. */
  readonly files: readonly NumstatEntryDto[]
  /** Untracked paths in the worktree, a folder ending in a slash. Repo-controlled: render as plain text only. */
  readonly untracked: readonly string[]
}

/** One worktree agent's diff, or the reason it couldn't be computed. */
export interface AgentWorktreeDiffDto {
  /** The agent the diff belongs to. */
  readonly agentId: string
  /** Whether the base branch was inferred from the transcript rather than read from the spawn record. */
  readonly inferredBase: boolean
  /** The diff, or a code-only failure. */
  readonly result:
    | { readonly ok: true; readonly diff: WorktreeDiffStatDto }
    | { readonly ok: false; readonly code: WorktreeDiffCodeDto }
}

/** A teammate session's worktree, owned by one of its lead's subagents. */
export interface SharedWorktreeDto {
  /** The lead session that holds the subagent. */
  readonly lead: SessionRefDto
  /** The lead's subagent whose worktree the teammate works in. Its diff is in the lead session's worktree diffs. */
  readonly agentId: string
}

/** The worktree diffs of one session. */
export interface WorktreeDiffsDto {
  /** Whether git was usable. Anything but `ok` leaves `agents` empty. */
  readonly git: GitAvailabilityDto
  /** One entry per agent whose meta names a worktree branch, in tree order. */
  readonly agents: readonly AgentWorktreeDiffDto[]
  /**
   * Set when the session is a teammate grouped under a lead and its first cwd
   * equals, as exact text, the `worktreePath` of one of that lead's
   * subagents that names a worktree branch (the first in tree order). The
   * teammate has no branch of its own, so its changes are part of that
   * subagent's diff in the lead session, which covers the whole worktree:
   * the subagent's work, the lead's, and any other teammate's there. `null`
   * otherwise. Independent of `git`.
   */
  readonly sharedWorktree: SharedWorktreeDto | null
}
