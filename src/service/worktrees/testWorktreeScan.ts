import { afterEach } from 'vitest'
import { toAgentId } from '../../core/transcript/ids'
import { buildJsonlText } from '../../core/transcript/testFixtures'
import type { TestRepo } from '../../core/git/testGitRepo'
import { scanSession, type SessionScan } from '../../core/session/scanSession'
import { createSessionScanDir, type SessionScanDir } from '../../core/session/testSessionDir'
import { buildSpawnRecord } from '../../core/session/testSpawnFixtures'

/** One synthetic worktree agent for {@link scanWorktreeSession}. */
export interface WorktreeAgentFixture {
  /** The subagent's id. */
  readonly agentId: string
  /** The branch its meta names. */
  readonly worktreeBranch: string
  /** The worktree path its meta names, or `undefined` for none. */
  readonly worktreePath?: string
}

/** Options for {@link scanWorktreeSession}. */
export interface WorktreeScanOptions {
  /** Where the lead's records and every spawn happen. */
  readonly cwd: string
  /** The branch recorded on the spawn records. Defaults to `main`. */
  readonly gitBranch?: string
  /** The worktree agents to spawn. */
  readonly agents: readonly WorktreeAgentFixture[]
}

/** A scanned synthetic session and its temp directory. */
export interface WorktreeScanFixture {
  /** The scan of the lead and its agents. */
  readonly scan: SessionScan
  /** Removes the session's temp files. */
  readonly cleanup: () => void
}

/**
 * Scans a synthetic session whose lead spawns each agent from `cwd`.
 * @param options - The spawn location and the agents.
 * @returns The scan and its cleanup.
 */
export async function scanWorktreeSession(
  options: WorktreeScanOptions
): Promise<WorktreeScanFixture> {
  const { cwd, gitBranch = 'main', agents } = options
  const dir: SessionScanDir = createSessionScanDir()
  const subagents = agents.map((agent) =>
    dir.addSubagent(agent.agentId, {
      transcript: buildJsonlText([]),
      meta: {
        agentType: 'x',
        toolUseId: `toolu_${agent.agentId}`,
        worktreeBranch: agent.worktreeBranch,
        ...(agent.worktreePath === undefined ? {} : { worktreePath: agent.worktreePath })
      }
    })
  )
  const lead = agents.map((agent) =>
    buildSpawnRecord({ toolUseIds: [`toolu_${agent.agentId}`], cwd, gitBranch })
  )
  const scan = await scanSession({
    leadPath: dir.writeLead(buildJsonlText(lead)),
    subagents
  })
  return { scan, cleanup: dir.cleanup }
}

/** Options for {@link addAgentWorktree}. */
export interface AddAgentWorktreeOptions {
  /** The test repo. */
  readonly repo: TestRepo
  /** The branch name, also the worktree folder name. */
  readonly name: string
  /** The folder to create it in. Defaults to the repo's parent temp folder. */
  readonly parent?: string
}

/**
 * Adds a worktree on a new branch off `main` with one committed file.
 * @param options - The repo, name, and optional parent folder.
 * @returns The worktree's path.
 */
export async function addAgentWorktree(options: AddAgentWorktreeOptions): Promise<string> {
  const { repo, name, parent = options.repo.root } = options
  const path = `${parent}/${name}`
  repo.git(['worktree', 'add', '--quiet', '-b', name, path, 'main'])
  await repo.write({ path: `${name}.txt`, content: 'work\n', dir: path })
  repo.git(['add', '-A'], path)
  repo.git(['commit', '--quiet', '-m', name], path)
  return path
}

/**
 * The folder Claude Code creates agent worktrees in, inside the repo.
 * @param repo - The test repo.
 * @returns The absolute folder path.
 */
export function projectWorktreesDir(repo: TestRepo): string {
  return `${repo.dir}/.claude/worktrees`
}

/** Options for {@link withSpawnCwd}. */
export interface WithSpawnCwdOptions {
  /** The scan to copy. */
  readonly scan: SessionScan
  /** The agent whose spawn context changes. */
  readonly agentId: string
  /** The new spawn working directory. */
  readonly cwd: string
}

/**
 * Copies a scan with one agent's spawn `cwd` replaced, as a forged transcript would.
 * @param options - The scan, the agent, and the forged directory.
 * @returns The altered scan.
 */
export function withSpawnCwd(options: WithSpawnCwdOptions): SessionScan {
  const { scan, agentId, cwd } = options
  const id = toAgentId(agentId)
  const original = scan.spawnContexts.get(id)
  if (original === undefined) throw new Error('missing spawn context')
  return { ...scan, spawnContexts: new Map(scan.spawnContexts).set(id, { ...original, cwd }) }
}

/** Creates scans that are removed after each test. */
export interface WorktreeScans {
  /**
   * Scans a synthetic session and removes its temp files after the test.
   * @param options - The spawn location and the agents.
   */
  readonly fixture: (options: WorktreeScanOptions) => Promise<WorktreeScanFixture>
}

/**
 * Registers the cleanup hook for synthetic session scans. Call it once at the
 * top of a test file.
 * @returns The scan factory.
 */
export function registerWorktreeScans(): WorktreeScans {
  const cleanups: (() => void)[] = []
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup()
  })
  return {
    fixture: async (options) => {
      const scanned = await scanWorktreeSession(options)
      cleanups.push(scanned.cleanup)
      return scanned
    }
  }
}
