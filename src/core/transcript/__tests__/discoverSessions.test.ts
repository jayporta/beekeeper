import { chmod, mkdir, utimes } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverSessions, type SessionEntry } from '../discoverSessions'
import { buildDiscoveryTree, type DiscoveryTree } from '../testDiscoveryTree'
import type { ReversedReaddirState } from '../testReversedReaddir'
import type { TranscriptFileInfo } from '../statTranscriptFile'

const reversedReaddirState = vi.hoisted<ReversedReaddirState>(() => ({
  reverseListingFor: undefined
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  const { buildReversedReaddirModule } = await import('../testReversedReaddir')
  return buildReversedReaddirModule(actual, reversedReaddirState)
})

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
  reversedReaddirState.reverseListingFor = undefined
})

/** Unwraps a session's `transcript` result, failing the test if it's an error. */
function expectOkTranscript(session: SessionEntry | undefined): TranscriptFileInfo {
  const result = session?.transcript
  if (result === undefined || !result.ok) {
    throw new Error(`Expected ok transcript, got ${JSON.stringify(result)}`)
  }
  return result.value
}

describe('discoverSessions', () => {
  it('returns an empty array when the project path does not exist', async () => {
    tree = await buildDiscoveryTree({})

    const sessions = await discoverSessions(join(tree.root, 'missing-project'))

    expect(sessions).toEqual([])
  })

  it('returns an empty array for an empty project', async () => {
    tree = await buildDiscoveryTree({})
    const projectDir = join(tree.root, 'empty-project')
    await mkdir(projectDir)

    const sessions = await discoverSessions(projectDir)

    expect(sessions).toEqual([])
  })

  it('only accepts a lowercase UUID transcript, ignoring everything else', async () => {
    const validId = '55555555-5555-5555-5555-555555555555'
    const uppercaseId = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'
    const symlinkedId = '44444444-4444-4444-4444-444444444444'

    tree = await buildDiscoveryTree({
      files: {
        [`project/${validId}.jsonl`]: 'valid',
        [`project/${uppercaseId}.jsonl`]: 'rejected',
        'project/not-a-uuid.jsonl': 'rejected',
        [`project/33333333-3333-3333-3333-333333333333.jsonl/placeholder`]: '',
        'project/real-target.jsonl': 'target content',
        'project/memory/notes.jsonl': 'rejected',
        'project/.DS_Store': ''
      },
      symlinks: { [`project/${symlinkedId}.jsonl`]: 'real-target.jsonl' }
    })

    const sessions = await discoverSessions(join(tree.root, 'project'))

    expect(sessions.map((s) => s.sessionId)).toEqual([validId])
  })

  it('returns sessions in code-unit order regardless of filesystem listing order', async () => {
    const ids = [
      '99999999-9999-9999-9999-999999999999',
      '11111111-1111-1111-1111-111111111111',
      '77777777-7777-7777-7777-777777777777',
      '33333333-3333-3333-3333-333333333333'
    ]
    tree = await buildDiscoveryTree({
      files: Object.fromEntries(ids.map((id) => [`project/${id}.jsonl`, '']))
    })
    reversedReaddirState.reverseListingFor = join(tree.root, 'project')

    const sessions = await discoverSessions(join(tree.root, 'project'))

    expect(sessions.map((s) => s.sessionId)).toEqual([
      '11111111-1111-1111-1111-111111111111',
      '33333333-3333-3333-3333-333333333333',
      '77777777-7777-7777-7777-777777777777',
      '99999999-9999-9999-9999-999999999999'
    ])
  })

  it('reports an exact mtimeMs and a size matching the bytes written', async () => {
    const id = '66666666-1111-1111-1111-111111111111'
    const content = 'hello transcript'
    tree = await buildDiscoveryTree({ files: { [`project/${id}.jsonl`]: content } })
    const transcriptPath = join(tree.root, 'project', `${id}.jsonl`)
    const knownMtime = new Date('2024-01-01T00:00:00.000Z')
    await utimes(transcriptPath, knownMtime, knownMtime)

    const sessions = await discoverSessions(join(tree.root, 'project'))

    expect(sessions).toHaveLength(1)
    const transcript = expectOkTranscript(sessions[0])
    expect(transcript.size).toBe(Buffer.byteLength(content, 'utf-8'))
    expect(transcript.mtimeMs).toBe(knownMtime.getTime())
    expect(transcript.path).toBe(transcriptPath)
  })

  it('reports an empty ok subagents result for a session with no session folder', async () => {
    const id = '55555555-1111-1111-1111-111111111111'
    tree = await buildDiscoveryTree({ files: { [`project/${id}.jsonl`]: '' } })

    const sessions = await discoverSessions(join(tree.root, 'project'))

    expect(sessions[0]?.subagents).toEqual({ ok: true, value: [] })
  })

  it('resolves a relative projectPath into an absolute transcript path', async () => {
    const id = '77777777-4040-4040-4040-404040404040'
    tree = await buildDiscoveryTree({ files: { [`project/${id}.jsonl`]: '' } })
    const relativeProjectPath = relative(process.cwd(), join(tree.root, 'project'))

    const sessions = await discoverSessions(relativeProjectPath)

    expect(sessions).toHaveLength(1)
    const transcriptPath = expectOkTranscript(sessions[0]).path
    expect(transcriptPath).toBe(join(tree.root, 'project', `${id}.jsonl`))
    expect(isAbsolute(transcriptPath)).toBe(true)
  })

  it.skipIf(process.getuid?.() === 0)(
    'rejects when the project directory cannot be read for a reason other than missing',
    async () => {
      tree = await buildDiscoveryTree({})
      const lockedDir = join(tree.root, 'locked')
      await mkdir(lockedDir)

      try {
        await chmod(lockedDir, 0o000)
        await expect(discoverSessions(lockedDir)).rejects.toMatchObject({ code: 'EACCES' })
      } finally {
        await chmod(lockedDir, 0o755)
      }
    }
  )
})
