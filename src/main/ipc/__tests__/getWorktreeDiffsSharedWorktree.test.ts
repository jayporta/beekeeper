import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { err } from '../../../core/shared/result'
import {
  buildAssistantRecord,
  buildJsonlText,
  buildUserRecord
} from '../../../core/transcript/testFixtures'
import { getWorktreeDiffsHandler } from '../getWorktreeDiffsHandler'
import type { IpcDeps } from '../ipcDeps'
import {
  AGENT_SESSION_ID,
  HUMAN_SESSION_ID,
  WORKTREE,
  scoutRecords,
  writeLead,
  writeTranscript
} from '../testFamilyFixtures'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

const CWD = '/repo/.claude/worktrees/agent-x'

/** The tree's own `agent-a1` is a subagent without a worktree; this one owns `CWD`. */
interface OwningSubagentOptions {
  /** The subagent's id. Defaults to `a0`. */
  readonly agentId?: string
  /** The `worktreePath` in its meta. Defaults to `CWD`. */
  readonly worktreePath?: string
  /** Whether its meta names a worktree branch. Defaults to `true`. */
  readonly branch?: boolean
}

async function writeOwningSubagent(options: OwningSubagentOptions = {}): Promise<void> {
  const { agentId = 'a0', worktreePath = CWD, branch = true } = options
  const dir = join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT, TEST_SESSION_ID, 'subagents')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `agent-${agentId}.jsonl`), buildJsonlText([buildAssistantRecord()]))
  await writeFile(
    join(dir, `agent-${agentId}.meta.json`),
    JSON.stringify({
      agentType: 'Explore',
      worktreePath,
      ...(branch ? { worktreeBranch: `wt-${agentId}` } : {})
    })
  )
}

/** Writes the `scout` teammate, with a first cwd unless `cwd` is `undefined`. */
async function writeScout(cwd: string | undefined): Promise<void> {
  await writeTranscript(ctx.tree.home, {
    projectDirName: WORKTREE,
    sessionId: AGENT_SESSION_ID,
    records: scoutRecords(cwd)
  })
}

async function sharedWorktreeOf(
  projectDirName: string,
  sessionId: string,
  deps: IpcDeps = ctx.deps
): Promise<unknown> {
  const result = await getWorktreeDiffsHandler(deps, { projectDirName, sessionId })
  if (!result.ok) throw new Error('getWorktreeDiffs failed')
  return result.value.sharedWorktree
}

describe('getWorktreeDiffsHandler sharedWorktree', () => {
  it('points a worktree-folder teammate at the lead subagent owning its cwd', async () => {
    await writeLead(ctx.tree.home)
    await writeOwningSubagent()
    await writeScout(CWD)

    expect(await sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID)).toEqual({
      lead: { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID },
      agentId: 'a0'
    })
  })

  it('points at the subagent even when git is unavailable', async () => {
    await writeLead(ctx.tree.home)
    await writeOwningSubagent()
    await writeScout(CWD)
    const deps: IpcDeps = { ...ctx.deps, git: () => Promise.resolve(err('git-not-found')) }

    const result = await getWorktreeDiffsHandler(deps, {
      projectDirName: WORKTREE,
      sessionId: AGENT_SESSION_ID
    })

    expect(result).toMatchObject({
      ok: true,
      value: { git: 'git-not-found', sharedWorktree: { agentId: 'a0' } }
    })
  })

  it('gives null when the teammate has no lead', async () => {
    await writeOwningSubagent()
    await writeScout(CWD)

    expect(await sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID)).toBeNull()
  })

  it('gives null when no lead subagent owns the teammate cwd', async () => {
    await writeLead(ctx.tree.home)
    await writeOwningSubagent({ worktreePath: '/repo/.claude/worktrees/other' })
    await writeScout(CWD)

    expect(await sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID)).toBeNull()
  })

  it('gives null for a human session in the worktree folder', async () => {
    await writeLead(ctx.tree.home)
    await writeOwningSubagent()
    await writeTranscript(ctx.tree.home, {
      projectDirName: WORKTREE,
      sessionId: HUMAN_SESSION_ID,
      records: [buildUserRecord({ extra: { cwd: CWD } })]
    })

    expect(await sharedWorktreeOf(WORKTREE, HUMAN_SESSION_ID)).toBeNull()
  })

  it('gives null for the lead itself', async () => {
    await writeLead(ctx.tree.home)
    await writeOwningSubagent()
    await writeScout(CWD)

    expect(await sharedWorktreeOf(TEST_PROJECT, TEST_SESSION_ID)).toBeNull()
  })

  it('reads no sibling folder session for a lead', async () => {
    await writeLead(ctx.tree.home)
    await writeScout(CWD)
    const reads: string[] = []
    const deps: IpcDeps = {
      ...ctx.deps,
      summaryCache: {
        read: (file) => {
          reads.push(file.path)
          return ctx.deps.summaryCache.read(file)
        }
      }
    }

    await sharedWorktreeOf(TEST_PROJECT, TEST_SESSION_ID, deps)

    expect(reads).toEqual([expect.stringContaining(`${TEST_SESSION_ID}.jsonl`)])
  })

  it('gives null when its subagent meta names the path but no worktree branch', async () => {
    await writeLead(ctx.tree.home)
    await writeOwningSubagent({ branch: false })
    await writeScout(CWD)

    expect(await sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID)).toBeNull()
  })

  it('gives null when the teammate recorded no cwd', async () => {
    await writeLead(ctx.tree.home)
    await writeOwningSubagent()
    await writeScout(undefined)

    expect(await sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID)).toBeNull()
  })

  it('names the first subagent in tree order when two share the path', async () => {
    await writeLead(ctx.tree.home)
    await writeOwningSubagent({ agentId: 'b1' })
    await writeOwningSubagent({ agentId: 'a1' })
    await writeScout(CWD)

    expect(await sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID)).toMatchObject({ agentId: 'a1' })
  })

  it('rejects when the lead scan fails with an error that has no system code', async () => {
    await writeLead(ctx.tree.home)
    await writeOwningSubagent()
    await writeScout(CWD)
    const deps: IpcDeps = {
      ...ctx.deps,
      scans: {
        run: (key, task) =>
          key.includes(TEST_SESSION_ID)
            ? Promise.reject(new TypeError('bug'))
            : ctx.deps.scans.run(key, task)
      }
    }

    await expect(sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID, deps)).rejects.toThrow(TypeError)
  })

  describe.skipIf(process.getuid?.() === 0)('when the lead transcript becomes unreadable', () => {
    const leadPath = (): string =>
      join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT, `${TEST_SESSION_ID}.jsonl`)

    /** Deps that make the lead's transcript unreadable right after its summary is read. */
    function depsBlockingLeadTranscript(): IpcDeps {
      return {
        ...ctx.deps,
        summaryCache: {
          read: async (file) => {
            const summary = await ctx.deps.summaryCache.read(file)
            if (file.path === leadPath()) await chmod(leadPath(), 0o000)
            return summary
          }
        }
      }
    }

    afterEach(async () => {
      await chmod(leadPath(), 0o644)
      vi.restoreAllMocks()
    })

    it('gives null and logs only the error code when the lead cannot be scanned', async () => {
      await writeLead(ctx.tree.home)
      await writeOwningSubagent()
      await writeScout(CWD)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const shared = await sharedWorktreeOf(
        WORKTREE,
        AGENT_SESSION_ID,
        depsBlockingLeadTranscript()
      )

      expect(shared).toBeNull()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('EACCES'))
      expect(warn.mock.calls.flat().join(' ')).not.toContain(ctx.tree.home)
    })
  })
})
