import type { CommitSha } from '../../core/git/commitSha'
import type { GitBinary } from '../../core/git/gitBinary'
import { resolveBranch, type ResolveBranchError } from '../../core/git/resolveBranch'
import {
  worktreeDiffStat,
  type WorktreeDiffStat,
  type WorktreeDiffStatError
} from '../../core/git/worktreeDiffStat'
import type { AgentTreeNode } from '../../core/session/agentTree'
import type { SessionScan } from '../../core/session/scanSession'
import type { AgentId } from '../../core/transcript/ids'
import { err, ok, type Result } from '../../core/transcript/result'
import type { ScanScheduler } from '../ipc/scanScheduler'
import { createRepoConfiner, type ConfineRepoError } from './confineRepo'

/** Why one agent's worktree diff is unavailable. */
export type WorktreeDiffCode = WorktreeDiffStatError | ConfineRepoError | 'no-base'

/** One worktree agent's diff, or the reason it couldn't be computed. */
export interface AgentWorktreeDiff {
  /** The agent the diff belongs to. */
  readonly agentId: AgentId
  /** Whether the base branch was inferred from the transcript rather than read from the spawn record. */
  readonly inferredBase: boolean
  /** What the agent's branch changed, or why that is unknown. */
  readonly result: Result<WorktreeDiffStat, WorktreeDiffCode>
}

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
 * Computes what each worktree agent of a session changed.
 *
 * @remarks
 * Each agent's whole pipeline (confining its spawn repository to the project,
 * resolving the base, and diffing) runs as one `scheduler` task, so no git
 * runs outside the cap. Each distinct spawn directory is verified once and
 * each distinct (repository, base branch) resolved once. A worktree path
 * outside the project is ignored, leaving a branch-only diff. Every failure
 * is reported on its agent, so one bad agent never hides the others. A
 * session with no worktree agents runs no git.
 *
 * @param options - The git binary, the scan, the project name, and the scheduler.
 * @returns One entry per agent whose meta names a worktree branch, in tree order.
 */
export async function sessionWorktreeDiffs(
  options: SessionWorktreeDiffsOptions
): Promise<AgentWorktreeDiff[]> {
  const { git, scan, projectDirName, scheduler, resolve = resolveBranch } = options
  const agents = collectWorktreeAgents(scan.tree)
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

  async function computeDiff(
    input: DiffInput
  ): Promise<Result<WorktreeDiffStat, WorktreeDiffCode>> {
    const { agent, baseBranch, spawnCwd } = input
    const repo = await confiner.repo(spawnCwd)
    if (!repo.ok) return err(repo.error)
    const base = await baseFor(repo.value, baseBranch)
    if (!base.ok) return err(base.error)
    const worktree =
      agent.worktreePath === undefined ? ok(undefined) : await confiner.worktree(agent.worktreePath)
    if (!worktree.ok) return err(worktree.error)
    return worktreeDiffStat({
      git,
      repoDir: repo.value,
      baseSha: base.value,
      agentBranch: agent.branch,
      worktreeDir: worktree.value
    })
  }

  async function diffAgent(agent: WorktreeAgent): Promise<AgentWorktreeDiff> {
    const context = scan.spawnContexts.get(agent.agentId)
    const inferredBase = context?.inferred ?? false
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
    const result = await scheduler.run(`worktree-diff:${key}`, () =>
      computeDiff({ agent, baseBranch, spawnCwd: cwd })
    )
    return { agentId: agent.agentId, inferredBase, result }
  }

  return Promise.all(agents.map(diffAgent))
}
