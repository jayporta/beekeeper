import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import type { GitBinary } from '../../core/git/gitBinary'
import { ok } from '../../core/shared/result'
import { buildJsonlText } from '../../core/transcript/testFixtures'
import { buildSpawnRecord } from '../../core/session/testSpawnFixtures'
import { createIpcDeps } from './createIpcDeps'
import type { IpcDeps } from './ipcDeps'
import { TEST_SESSION_ID } from './testIpcTree'

/** One subagent of a synthetic session, as its meta file names it. */
export interface WorktreeSessionAgent {
  /** The subagent's id. */
  readonly agentId: string
  /** The worktree branch its meta names, or `undefined` for none. */
  readonly worktreeBranch?: string
  /** The worktree path its meta names. */
  readonly worktreePath?: string
  /** The working directory its spawn record gives. Defaults to the session's `cwd`. */
  readonly spawnCwd?: string
}

/** Options for {@link WorktreeSessions.create}. */
export interface WorktreeSessionOptions {
  /** The project folder's name under the synthetic `~/.claude/projects`. */
  readonly projectDirName: string
  /** The lead's working directory. */
  readonly cwd: string
  /** The session's subagents, each spawned from its `spawnCwd` or the lead's `cwd`. */
  readonly agents: readonly WorktreeSessionAgent[]
  /** The git the handlers locate. */
  readonly git: GitBinary
}

/** A synthetic session on disk, and handler dependencies that read it. */
export interface WorktreeSession {
  /** Handler dependencies rooted at the synthetic home, locating the given git. */
  readonly deps: IpcDeps
  /** The request naming the session, without an agent. */
  readonly request: { readonly projectDirName: string; readonly sessionId: string }
}

/** Creates synthetic sessions whose homes are removed after each test. */
export interface WorktreeSessions {
  /**
   * Writes a session of subagents with worktree metas under a temp home.
   * @param options - The project, the lead's directory, the agents, and the git.
   */
  readonly create: (options: WorktreeSessionOptions) => Promise<WorktreeSession>
}

/**
 * Registers the cleanup hook for synthetic worktree sessions. Call it once at
 * the top of a test file.
 * @returns The session factory.
 */
export function registerWorktreeSessions(): WorktreeSessions {
  const homes: string[] = []
  afterEach(async () => {
    await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
  })
  return {
    create: async ({ projectDirName, cwd, agents, git }) => {
      const home = await mkdtemp(join(tmpdir(), 'beekeeper-worktree-'))
      homes.push(home)
      const sessionDir = join(home, '.claude', 'projects', projectDirName)
      const subagents = join(sessionDir, TEST_SESSION_ID, 'subagents')
      await mkdir(subagents, { recursive: true })
      const spawns = agents.map((agent) =>
        buildSpawnRecord({
          toolUseIds: [`toolu_${agent.agentId}`],
          cwd: agent.spawnCwd ?? cwd
        })
      )
      await writeFile(join(sessionDir, `${TEST_SESSION_ID}.jsonl`), buildJsonlText(spawns))
      for (const agent of agents) {
        await writeFile(join(subagents, `agent-${agent.agentId}.jsonl`), buildJsonlText([]))
        await writeFile(
          join(subagents, `agent-${agent.agentId}.meta.json`),
          JSON.stringify({
            agentType: 'x',
            toolUseId: `toolu_${agent.agentId}`,
            ...(agent.worktreeBranch === undefined ? {} : { worktreeBranch: agent.worktreeBranch }),
            ...(agent.worktreePath === undefined ? {} : { worktreePath: agent.worktreePath })
          })
        )
      }
      return {
        deps: { ...createIpcDeps(home), git: () => Promise.resolve(ok(git)) },
        request: { projectDirName, sessionId: TEST_SESSION_ID }
      }
    }
  }
}
