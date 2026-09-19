import { chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverSessions } from '../discoverSessions'
import { buildDiscoveryTree, type DiscoveryTree } from '../testDiscoveryTree'
import type { ThrowingLstatState } from '../testThrowingLstat'
import type { ThrowingReaddirState } from '../testThrowingReaddir'

const throwingReaddirState = vi.hoisted<ThrowingReaddirState>(() => ({
  throwForDir: undefined,
  throwError: undefined
}))

const throwingLstatState = vi.hoisted<ThrowingLstatState>(() => ({
  throwForPath: undefined,
  throwError: undefined
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  const { withThrowingReaddir } = await import('../testThrowingReaddir')
  const { withThrowingLstat } = await import('../testThrowingLstat')
  return {
    ...actual,
    readdir: withThrowingReaddir(actual.readdir, throwingReaddirState),
    lstat: withThrowingLstat(actual.lstat, throwingLstatState)
  }
})

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
  throwingReaddirState.throwForDir = undefined
  throwingReaddirState.throwError = undefined
  throwingLstatState.throwForPath = undefined
  throwingLstatState.throwError = undefined
})

describe('discoverSessions isolation', () => {
  it('skips a session whose transcript vanishes after listing, keeping its sibling', async () => {
    const vanishedId = '77777777-4444-aaaa-aaaa-aaaaaaaaaaaa'
    const okId = '77777777-5555-bbbb-bbbb-bbbbbbbbbbbb'
    tree = await buildDiscoveryTree({
      files: { [`project/${vanishedId}.jsonl`]: '', [`project/${okId}.jsonl`]: '' }
    })
    throwingLstatState.throwForPath = join(tree.root, 'project', `${vanishedId}.jsonl`)
    throwingLstatState.throwError = Object.assign(new Error('no such file'), { code: 'ENOENT' })

    const sessions = await discoverSessions(join(tree.root, 'project'))

    expect(sessions.map((s) => s.sessionId)).toEqual([okId])
  })

  it('isolates an unreadable subagents folder to its own session, leaving a sibling ok', async () => {
    const lockedId = '77777777-9999-9999-9999-999999999999'
    const okId = '77777777-1010-1010-1010-101010101010'
    tree = await buildDiscoveryTree({
      files: {
        [`project/${lockedId}.jsonl`]: '',
        [`project/${lockedId}/subagents/agent-a.jsonl`]: '',
        [`project/${okId}.jsonl`]: '',
        [`project/${okId}/subagents/agent-b.jsonl`]: ''
      }
    })
    throwingReaddirState.throwForDir = join(tree.root, 'project', lockedId, 'subagents')
    throwingReaddirState.throwError = Object.assign(new Error('permission denied'), {
      code: 'EACCES'
    })

    const sessions = await discoverSessions(join(tree.root, 'project'))

    const locked = sessions.find((s) => s.sessionId === lockedId)
    const okSession = sessions.find((s) => s.sessionId === okId)
    expect(locked?.subagents).toEqual({
      ok: false,
      error: { reason: 'unreadable', code: 'EACCES' }
    })
    expect(okSession?.subagents).toEqual({
      ok: true,
      value: [expect.objectContaining({ agentId: 'b' })]
    })
  })

  it('isolates an unreadable transcript to its own session, leaving a sibling ok', async () => {
    const lockedId = '77777777-2222-eeee-eeee-eeeeeeeeeeee'
    const okId = '77777777-3333-ffff-ffff-ffffffffffff'
    tree = await buildDiscoveryTree({
      files: {
        [`project/${lockedId}.jsonl`]: '',
        [`project/${okId}.jsonl`]: ''
      }
    })
    throwingLstatState.throwForPath = join(tree.root, 'project', `${lockedId}.jsonl`)
    throwingLstatState.throwError = Object.assign(new Error('input/output error'), { code: 'EIO' })

    const sessions = await discoverSessions(join(tree.root, 'project'))

    const locked = sessions.find((s) => s.sessionId === lockedId)
    const okSession = sessions.find((s) => s.sessionId === okId)
    expect(locked?.transcript).toEqual({ ok: false, error: { reason: 'unreadable', code: 'EIO' } })
    expect(okSession?.transcript.ok).toBe(true)
  })

  it.skipIf(process.getuid?.() === 0)(
    'lists a session with an unreadable transcript when the project folder lacks search permission',
    async () => {
      const id = '77777777-4444-aaaa-aaaa-aaaaaaaaaaaa'
      tree = await buildDiscoveryTree({ files: { [`project/${id}.jsonl`]: '' } })
      const projectDir = join(tree.root, 'project')

      try {
        await chmod(projectDir, 0o400)
        const sessions = await discoverSessions(projectDir)

        expect(sessions).toHaveLength(1)
        const transcript = sessions[0]?.transcript
        if (transcript === undefined || transcript.ok) {
          throw new Error(`Expected an err transcript, got ${JSON.stringify(transcript)}`)
        }
        expect(['EACCES', 'EPERM']).toContain(transcript.error.code)
      } finally {
        await chmod(projectDir, 0o755)
      }
    }
  )

  it('rejects when reading a subagents folder throws an error with no error code', async () => {
    const id = '77777777-2020-2020-2020-202020202020'
    tree = await buildDiscoveryTree({
      files: { [`project/${id}.jsonl`]: '', [`project/${id}/subagents/agent-a.jsonl`]: '' }
    })
    throwingReaddirState.throwForDir = join(tree.root, 'project', id, 'subagents')
    throwingReaddirState.throwError = new Error('boom')

    await expect(discoverSessions(join(tree.root, 'project'))).rejects.toThrow('boom')
  })

  it('rejects when reading a subagents folder throws a programmer (ERR_*) error', async () => {
    const id = '77777777-3030-3030-3030-303030303030'
    tree = await buildDiscoveryTree({
      files: { [`project/${id}.jsonl`]: '', [`project/${id}/subagents/agent-a.jsonl`]: '' }
    })
    throwingReaddirState.throwForDir = join(tree.root, 'project', id, 'subagents')
    throwingReaddirState.throwError = Object.assign(new Error('bad arg'), {
      code: 'ERR_INVALID_ARG_VALUE'
    })

    await expect(discoverSessions(join(tree.root, 'project'))).rejects.toMatchObject({
      code: 'ERR_INVALID_ARG_VALUE'
    })
  })
})
