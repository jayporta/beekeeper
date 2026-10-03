import { chmod, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_TRANSCRIPT_CANDIDATES, findTranscriptCandidates } from '../findTranscriptCandidates'
import { buildDiscoveryTree, type DiscoveryTree } from '../testDiscoveryTree'

const idOf = (n: number): string =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
})

describe('findTranscriptCandidates', () => {
  it('lists session transcript file names in name order', async () => {
    tree = await buildDiscoveryTree({
      files: {
        [`p/${idOf(3)}.jsonl`]: 'c\n',
        [`p/${idOf(1)}.jsonl`]: 'a\n',
        [`p/${idOf(2)}.jsonl`]: 'b\n'
      }
    })

    expect(await findTranscriptCandidates(join(tree.root, 'p'))).toEqual([
      `${idOf(1)}.jsonl`,
      `${idOf(2)}.jsonl`,
      `${idOf(3)}.jsonl`
    ])
  })

  it('returns at most the candidate limit, the first in name order', async () => {
    const files = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`p/${idOf(n)}.jsonl`, 'x\n']))
    tree = await buildDiscoveryTree({ files })

    const candidates = await findTranscriptCandidates(join(tree.root, 'p'))

    expect(candidates).toEqual(
      [1, 2, 3].map((n) => `${idOf(n)}.jsonl`).slice(0, MAX_TRANSCRIPT_CANDIDATES)
    )
    expect(candidates).toHaveLength(3)
  })

  it('ignores a transcript inside a subfolder', async () => {
    tree = await buildDiscoveryTree({
      files: { [`p/${idOf(1)}.jsonl`]: 'a\n', [`p/${idOf(1)}/subagents/${idOf(2)}.jsonl`]: 'b\n' }
    })

    expect(await findTranscriptCandidates(join(tree.root, 'p'))).toEqual([`${idOf(1)}.jsonl`])
  })

  it('ignores a symlinked transcript, as session discovery does', async () => {
    tree = await buildDiscoveryTree({
      files: { [`p/${idOf(2)}.jsonl`]: 'a\n', 'elsewhere/real.jsonl': 'b\n' },
      symlinks: { [`p/${idOf(1)}.jsonl`]: join('..', 'elsewhere', 'real.jsonl') }
    })

    expect(await findTranscriptCandidates(join(tree.root, 'p'))).toEqual([`${idOf(2)}.jsonl`])
  })

  it('ignores files that are not session transcripts', async () => {
    tree = await buildDiscoveryTree({ files: { 'p/notes.jsonl': 'a\n', 'p/.DS_Store': 'b' } })

    expect(await findTranscriptCandidates(join(tree.root, 'p'))).toEqual([])
  })

  it('returns an empty list for a project with no transcripts', async () => {
    tree = await buildDiscoveryTree({})
    await mkdir(join(tree.root, 'p'))

    expect(await findTranscriptCandidates(join(tree.root, 'p'))).toEqual([])
  })

  it('returns an empty list when the project folder does not exist', async () => {
    tree = await buildDiscoveryTree({})

    expect(await findTranscriptCandidates(join(tree.root, 'missing'))).toEqual([])
  })

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'rejects with the system error when the project folder cannot be read',
    async () => {
      tree = await buildDiscoveryTree({ files: { [`p/${idOf(1)}.jsonl`]: 'a\n' } })
      await chmod(join(tree.root, 'p'), 0o000)

      try {
        await expect(findTranscriptCandidates(join(tree.root, 'p'))).rejects.toMatchObject({
          code: 'EACCES'
        })
      } finally {
        await chmod(join(tree.root, 'p'), 0o700)
      }
    }
  )
})
