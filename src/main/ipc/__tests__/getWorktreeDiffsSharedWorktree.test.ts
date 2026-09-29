import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { err } from '../../../core/shared/result'
import {
  buildAgentSettingRecord,
  buildAssistantRecord,
  buildJsonlText,
  buildUserRecord
} from '../../../core/transcript/testFixtures'
import { getWorktreeDiffsHandler } from '../getWorktreeDiffsHandler'
import type { IpcDeps } from '../ipcDeps'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

const WORKTREE = `${TEST_PROJECT}--claude-worktrees-feat`
const AGENT_SESSION_ID = '2b2b2b2b-2222-4222-8222-22222222222c'
const HUMAN_SESSION_ID = '4d4d4d4d-4444-4444-8444-44444444444e'
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

async function writeTranscript(
  projectDirName: string,
  sessionId: string,
  records: readonly unknown[]
): Promise<void> {
  const dir = join(ctx.tree.home, '.claude', 'projects', projectDirName)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${sessionId}.jsonl`), buildJsonlText(records))
}

async function writeLead(): Promise<void> {
  await writeTranscript(TEST_PROJECT, TEST_SESSION_ID, [
    buildAssistantRecord(),
    buildUserRecord({
      extra: { toolUseResult: { status: 'teammate_spawned', name: 'scout', team_name: 'team-1' } }
    })
  ])
}

/** Writes the `scout` teammate, with a first cwd unless `cwd` is `undefined`. */
async function writeScout(cwd: string | undefined): Promise<void> {
  await writeTranscript(WORKTREE, AGENT_SESSION_ID, [
    buildAgentSettingRecord('Explore'),
    buildUserRecord({
      extra: { agentName: 'scout', teamName: 'team-1', ...(cwd === undefined ? {} : { cwd }) }
    })
  ])
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
    await writeLead()
    await writeOwningSubagent()
    await writeScout(CWD)

    expect(await sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID)).toEqual({
      lead: { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID },
      agentId: 'a0'
    })
  })

  it('points at the subagent even when git is unavailable', async () => {
    await writeLead()
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
    await writeLead()
    await writeOwningSubagent({ worktreePath: '/repo/.claude/worktrees/other' })
    await writeScout(CWD)

    expect(await sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID)).toBeNull()
  })

  it('gives null for a human session in the worktree folder', async () => {
    await writeLead()
    await writeOwningSubagent()
    await writeTranscript(WORKTREE, HUMAN_SESSION_ID, [buildUserRecord({ extra: { cwd: CWD } })])

    expect(await sharedWorktreeOf(WORKTREE, HUMAN_SESSION_ID)).toBeNull()
  })

  it('gives null for the lead itself', async () => {
    await writeLead()
    await writeOwningSubagent()
    await writeScout(CWD)

    expect(await sharedWorktreeOf(TEST_PROJECT, TEST_SESSION_ID)).toBeNull()
  })

  it('reads no sibling folder session for a lead', async () => {
    await writeLead()
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
    await writeLead()
    await writeOwningSubagent({ branch: false })
    await writeScout(CWD)

    expect(await sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID)).toBeNull()
  })

  it('gives null when the teammate recorded no cwd', async () => {
    await writeLead()
    await writeOwningSubagent()
    await writeScout(undefined)

    expect(await sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID)).toBeNull()
  })

  it('names the first subagent in tree order when two share the path', async () => {
    await writeLead()
    await writeOwningSubagent({ agentId: 'b1' })
    await writeOwningSubagent({ agentId: 'a1' })
    await writeScout(CWD)

    expect(await sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID)).toMatchObject({ agentId: 'a1' })
  })

  describe.skipIf(process.getuid?.() === 0)('when the lead folder becomes unreadable', () => {
    /** Deps that change the lead folder's mode right after the lead's summary is read. */
    function depsChangingLeadDirMode(mode: number): IpcDeps {
      const leadDir = join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT)
      return {
        ...ctx.deps,
        summaryCache: {
          read: async (file) => {
            const summary = await ctx.deps.summaryCache.read(file)
            if (file.path.endsWith(`${TEST_SESSION_ID}.jsonl`)) await chmod(leadDir, mode)
            return summary
          }
        }
      }
    }

    afterEach(async () => {
      await chmod(join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT), 0o755)
      vi.restoreAllMocks()
    })

    it('gives null when only the lead transcript can no longer be stat-ed', async () => {
      await writeLead()
      await writeOwningSubagent()
      await writeScout(CWD)

      // Listable but not searchable: the folder lists, and each stat inside it fails.
      expect(
        await sharedWorktreeOf(WORKTREE, AGENT_SESSION_ID, depsChangingLeadDirMode(0o600))
      ).toBeNull()
    })

    it('gives null and logs only the error code when the lead folder cannot be listed', async () => {
      await writeLead()
      await writeOwningSubagent()
      await writeScout(CWD)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const shared = await sharedWorktreeOf(
        WORKTREE,
        AGENT_SESSION_ID,
        depsChangingLeadDirMode(0o000)
      )

      expect(shared).toBeNull()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('EACCES'))
      expect(warn.mock.calls.flat().join(' ')).not.toContain(ctx.tree.home)
    })
  })
})
