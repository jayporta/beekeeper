import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { resolveSubagentMeta } from '../../../core/session/resolveSubagentMeta'
import { MAX_AGENT_TERMS } from '../../../core/session/agentTermCaps'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import { createAgentTermsCache } from '../agentTermsCache'
import type { IpcDeps } from '../ipcDeps'
import { listSessionsHandler } from '../listSessionsHandler'
import { HUMAN_SESSION_ID, WORKTREE, writeTranscript } from '../testFamilyFixtures'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

const subagentsDir = (): string =>
  join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT, TEST_SESSION_ID, 'subagents')

async function addSubagent(id: string, meta: string | Record<string, unknown>): Promise<void> {
  await mkdir(subagentsDir(), { recursive: true })
  await writeFile(join(subagentsDir(), `agent-${id}.jsonl`), '', 'utf-8')
  await writeFile(
    join(subagentsDir(), `agent-${id}.meta.json`),
    typeof meta === 'string' ? meta : JSON.stringify(meta),
    'utf-8'
  )
}

async function listItem(deps: IpcDeps = ctx.deps): Promise<SessionListItemDto> {
  const result = await listSessionsHandler(deps, { projectDirName: TEST_PROJECT })
  const item = result.ok ? result.value.find((entry) => entry.sessionId === TEST_SESSION_ID) : null
  if (item === null || item === undefined) throw new Error('The session was not listed')
  return item
}

describe('listSessionsHandler agent terms', () => {
  it('sends each subagent’s name, description and type, and nothing else from its meta', async () => {
    await addSubagent('a2', {
      agentType: 'Plan',
      description: 'plan it',
      name: 'planner',
      model: 'x'
    })

    const item = await listItem()

    expect(item.agentTerms).toEqual([
      { name: null, description: 'look around', agentType: 'Explore' },
      { name: 'planner', description: 'plan it', agentType: 'Plan' }
    ])
    expect(item.agentTermsTruncated).toBe(false)
  })

  it('lists the session with its other terms when one meta is unreadable', async () => {
    await addSubagent('a2', 'not json')

    const item = await listItem()

    expect(item.agentTerms).toEqual([
      { name: null, description: 'look around', agentType: 'Explore' }
    ])
    expect(item.summary.ok).toBe(true)
  })

  it('sends no terms for a session without subagents, and reads only the metas that exist', async () => {
    await writeTranscript(ctx.tree.home, {
      projectDirName: TEST_PROJECT,
      sessionId: HUMAN_SESSION_ID,
      records: []
    })
    const readMeta = vi.fn(resolveSubagentMeta)
    const deps = { ...ctx.deps, agentTerms: createAgentTermsCache({ readMeta }) }
    const result = await listSessionsHandler(deps, { projectDirName: TEST_PROJECT })
    const bare = result.ok
      ? result.value.find((entry) => entry.sessionId === HUMAN_SESSION_ID)
      : null

    expect(bare?.agentTerms).toEqual([])
    expect(readMeta).toHaveBeenCalledTimes(1)
  })

  it('reads no meta of a sibling folder session that the list leaves out', async () => {
    await writeTranscript(ctx.tree.home, {
      projectDirName: WORKTREE,
      sessionId: HUMAN_SESSION_ID,
      records: []
    })
    const siblingSubagents = join(
      ctx.tree.home,
      '.claude',
      'projects',
      WORKTREE,
      HUMAN_SESSION_ID,
      'subagents'
    )
    await mkdir(siblingSubagents, { recursive: true })
    await writeFile(join(siblingSubagents, 'agent-s1.jsonl'), '', 'utf-8')
    await writeFile(
      join(siblingSubagents, 'agent-s1.meta.json'),
      JSON.stringify({ agentType: 'Plan' }),
      'utf-8'
    )
    const readMeta = vi.fn(resolveSubagentMeta)
    const deps = { ...ctx.deps, agentTerms: createAgentTermsCache({ readMeta }) }

    await listItem(deps)

    expect(readMeta.mock.calls.map(([path]) => path)).not.toContain(
      join(siblingSubagents, 'agent-s1.meta.json')
    )
  })

  it('reads no meta on a second listing when nothing changed', async () => {
    const readMeta = vi.fn(resolveSubagentMeta)
    const deps = { ...ctx.deps, agentTerms: createAgentTermsCache({ readMeta }) }
    await listItem(deps)
    readMeta.mockClear()

    const item = await listItem(deps)

    expect(readMeta).not.toHaveBeenCalled()
    expect(item.agentTerms).toHaveLength(1)
  })

  it('picks up a subagent that spawned after the session was first listed', async () => {
    const deps = { ...ctx.deps, agentTerms: createAgentTermsCache() }
    await listItem(deps)
    await addSubagent('a2', { agentType: 'Plan', name: 'late' })

    const item = await listItem(deps)

    expect(item.agentTerms.map((term) => term.name)).toEqual([null, 'late'])
  })

  it('reads the metas under the summaries scheduler', async () => {
    const keys: string[] = []
    const summaries: IpcDeps['summaries'] = {
      ...ctx.deps.summaries,
      run: (key, task) => {
        keys.push(key)
        return ctx.deps.summaries.run(key, task)
      }
    }

    await listItem({ ...ctx.deps, summaries })

    expect(keys.some((key) => key.startsWith('terms\0'))).toBe(true)
  })

  it('bounds a session with hundreds of subagents to the term cap and says so', async () => {
    for (let index = 0; index < 300; index += 1) {
      await addSubagent(`b${String(index).padStart(3, '0')}`, { agentType: `type-${index}` })
    }
    const readMeta = vi.fn(resolveSubagentMeta)
    const deps = { ...ctx.deps, agentTerms: createAgentTermsCache({ readMeta }) }

    const item = await listItem(deps)

    expect(item.agentTerms).toHaveLength(MAX_AGENT_TERMS)
    expect(item.agentTermsTruncated).toBe(true)
    expect(readMeta.mock.calls.length).toBeLessThanOrEqual(MAX_AGENT_TERMS + 1)
  })

  it('never writes term text to the log', async () => {
    await addSubagent('a2', { agentType: 'Plan', description: 'SECRET-TASK' })
    await addSubagent('a3', 'not json SECRET-TASK')
    const logged = [vi.spyOn(console, 'warn'), vi.spyOn(console, 'error'), vi.spyOn(console, 'log')]

    await listItem()

    expect(JSON.stringify(logged.flatMap((spy) => spy.mock.calls))).not.toContain('SECRET-TASK')
    for (const spy of logged) spy.mockRestore()
  })
})
