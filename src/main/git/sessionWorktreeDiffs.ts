import type { CommitSha } from '../../core/git/commitSha'
import type { GitBinary } from '../../core/git/gitBinary'
import { resolveBranch, type ResolveBranchError } from '../../core/git/resolveBranch'
import {
  worktreeDiffStat,
  type WorktreeDiffStat,
  type WorktreeDiffStatError,
  type WorktreeDiffStatOptions
} from '../../core/git/worktreeDiffStat'
import type { AgentTreeNode } from '../../core/session/agentTree'
import type { SessionScan } from '../../core/session/scanSession'
import { err, ok, type Result } from '../../core/shared/result'
import type { AgentId } from '../../core/transcript/ids'
import type { ScanScheduler } from '../ipc/scanScheduler'
import { createRepoConfiner, type ConfineRepoError } from './confineRepo'

/**
 * The most worktree agents whose diffs one request computes. Each computed
 * diff spawns git, and a transcript is untrusted input, so the number of
 * agents that reach git is bounded. Real sessions name a worktree branch on
 * few agents (the largest session has 43 subagents in all), so 64 leaves
 * room to spare. Agents past it, in tree order, are listed but not diffed.
 */
export const MAX_WORKTREE_AGENTS_PER_REQUEST = 64

/**
 * Why one agent's worktree diff is unavailable. `too-many-agents` marks an
 * agent past {@link MAX_WORKTREE_AGENTS_PER_REQUEST}, whose diff was not
 * attempted.
 */
export type WorktreeDiffCode =
  WorktreeDiffStatError | ConfineRepoError | 'no-base' | 'too-many-agents'

/** One worktree agent's result of reading its changes, or the reason it couldn't be read. */
export interface AgentWorktreeResult<T> {
  /** The agent the result belongs to. */
  readonly agentId: AgentId
  /** Whether the base branch was inferred from the transcript rather than read from the spawn record. */
  readonly inferredBase: boolean
  /** What the agent's branch changed, or why that is unknown. */
  readonly result: Result<T, WorktreeDiffCode>
}

/** One worktree agent's diff, or the reason it couldn't be computed. */
export type AgentWorktreeDiff = AgentWorktreeResult<WorktreeDiffStat>

/** Options for {@link sessionWorktreeDiffs}. */
export interface SessionWorktreeDiffsOptions {
  /** The verified git executable. */
  readonly git: GitBinary
  /** The scanned session. */
  readonly scan: SessionScan
  /** The project folder's name under `~/.claude/projects`. */
  readonly projectDirName: string
  /** Caps how many diffs run at once. */
  readonly scheduler: ScanScheduler
  /** Resolves a branch to a commit. Defaults to {@link resolveBranch}. */
  readonly resolve?: typeof resolveBranch
}

/** Options for {@link readWorktreeAgents}. */
export interface ReadWorktreeAgentsOptions<T> extends SessionWorktreeDiffsOptions {
  /** Reads one agent's changes once its repository, base, and worktree are confined and resolved. */
  readonly read: (options: WorktreeDiffStatOptions) => Promise<Result<T, WorktreeDiffStatError>>
  /**
   * Names the kind of read in the scheduler key, so reads of different kinds
   * for the same agent never share a task.
   */
  readonly kind: string
  /** Reads only this agent, when it names a worktree branch. Without it, every worktree agent. */
  readonly agentId?: AgentId
}

interface WorktreeAgent {
  readonly agentId: AgentId
  readonly branch: string
  readonly worktreePath: string | undefined
}

interface DiffInput {
  readonly agent: WorktreeAgent
  readonly baseBranch: string
  readonly spawnCwd: string
}

function collectWorktreeAgents(node: AgentTreeNode, found: WorktreeAgent[] = []): WorktreeAgent[] {
  const { identity, metaStatus } = node
  if (identity.kind === 'subagent' && metaStatus.status === 'ok') {
    const { worktreeBranch, worktreePath } = metaStatus.meta
    if (worktreeBranch !== undefined) {
      found.push({ agentId: identity.agentId, branch: worktreeBranch, worktreePath })
    }
  }
  for (const child of node.children) collectWorktreeAgents(child, found)
  return found
}

/**
 * Reads what each worktree agent of a session changed, with the read of the
 * caller's choosing.
 *
 * @remarks
 * Each agent's whole pipeline (confining its spawn repository to the project,
 * resolving the base, and diffing) runs as one `scheduler` task, so no git
 * runs outside the cap. Each distinct spawn directory is verified once and
 * each distinct (repository, base branch) resolved once. A worktree path
 * outside the project is ignored, leaving a branch-only diff. Every failure
 * is reported on its agent, so one bad agent never hides the others. A
 * session with no worktree agents runs no git. Only the first
 * {@link MAX_WORKTREE_AGENTS_PER_REQUEST} agents in tree order are diffed;
 * the rest are listed with `too-many-agents` and run no git.
 *
 * @param options - The git binary, the scan, the project name, the scheduler, the read, and optionally one agent.
 * @returns One entry per agent whose meta names a worktree branch (or just the named one, or none when it names no worktree branch), in tree order.
 */
export async function readWorktreeAgents<T>(
  options: ReadWorktreeAgentsOptions<T>
): Promise<AgentWorktreeResult<T>[]> {
  const { git, scan, projectDirName, scheduler, resolve = resolveBranch, read, kind } = options
  const agents = collectWorktreeAgents(scan.tree).filter(
    (agent) => options.agentId === undefined || agent.agentId === options.agentId
  )
  if (agents.length === 0) return []
  const confiner = createRepoConfiner({ git, projectDirName, firstCwd: scan.leadFirstCwd })
  const bases = new Map<string, Promise<Result<CommitSha, ResolveBranchError>>>()
  const baseFor = (
    repoDir: string,
    branch: string
  ): Promise<Result<CommitSha, ResolveBranchError>> => {
    const key = `${repoDir}\0${branch}`
    let base = bases.get(key)
    if (base === undefined) {
      base = resolve({ git, repoDir, branch })
      bases.set(key, base)
    }
    return base
  }

  const inferredBaseOf = (agent: WorktreeAgent): boolean =>
    scan.spawnContexts.get(agent.agentId)?.inferred ?? false

  async function computeDiff(input: DiffInput): Promise<Result<T, WorktreeDiffCode>> {
    const { agent, baseBranch, spawnCwd } = input
    const repo = await confiner.repo(spawnCwd)
    if (!repo.ok) return err(repo.error)
    const base = await baseFor(repo.value, baseBranch)
    if (!base.ok) return err(base.error)
    const worktree =
      agent.worktreePath === undefined ? ok(undefined) : await confiner.worktree(agent.worktreePath)
    if (!worktree.ok) return err(worktree.error)
    return read({
      git,
      repoDir: repo.value,
      baseSha: base.value,
      agentBranch: agent.branch,
      worktreeDir: worktree.value
    })
  }

  async function diffAgent(agent: WorktreeAgent): Promise<AgentWorktreeResult<T>> {
    const context = scan.spawnContexts.get(agent.agentId)
    const inferredBase = inferredBaseOf(agent)
    if (context?.baseBranch === undefined) {
      return { agentId: agent.agentId, inferredBase, result: err('no-base') }
    }
    const { baseBranch, cwd } = context
    const key = JSON.stringify([
      projectDirName,
      scan.leadFirstCwd ?? null,
      cwd,
      baseBranch,
      agent.branch,
      agent.worktreePath ?? null
    ])
    const result = await scheduler.run(`${kind}:${key}`, () =>
      computeDiff({ agent, baseBranch, spawnCwd: cwd })
    )
    return { agentId: agent.agentId, inferredBase, result }
  }

  function refuseAgent(agent: WorktreeAgent): AgentWorktreeResult<T> {
    return {
      agentId: agent.agentId,
      inferredBase: inferredBaseOf(agent),
      result: err('too-many-agents')
    }
  }

  return Promise.all(
    agents.map((agent, index) =>
      index < MAX_WORKTREE_AGENTS_PER_REQUEST ? diffAgent(agent) : refuseAgent(agent)
    )
  )
}

/**
 * Computes what each worktree agent of a session changed.
 *
 * @remarks
 * See {@link readWorktreeAgents}, which this is the numstat read of.
 *
 * @param options - The git binary, the scan, the project name, and the scheduler.
 * @returns One entry per agent whose meta names a worktree branch, in tree order.
 */
export function sessionWorktreeDiffs(
  options: SessionWorktreeDiffsOptions
): Promise<AgentWorktreeDiff[]> {
  return readWorktreeAgents({ ...options, read: worktreeDiffStat, kind: 'worktree-diff' })
}
