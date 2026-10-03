import { chmod, mkdir, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findNewestTranscript } from '../findNewestTranscript'
import { buildDiscoveryTree, type DiscoveryTree } from '../testDiscoveryTree'

const OLD_ID = '11111111-1111-4111-8111-111111111111'
const NEW_ID = '22222222-2222-4222-8222-222222222222'
const TIE_ID = '33333333-3333-4333-8333-333333333333'

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
})

/** Sets a file's modification time to `seconds` after the epoch. */
async function setMtime(path: string, seconds: number): Promise<void> {
  await utimes(path, seconds, seconds)
}

describe('findNewestTranscript', () => {
  it('returns the transcript with the latest modification time', async () => {
    tree = await buildDiscoveryTree({
      files: { [`p/${OLD_ID}.jsonl`]: 'a\n', [`p/${NEW_ID}.jsonl`]: 'b\n' }
    })
    await setMtime(join(tree.root, 'p', `${OLD_ID}.jsonl`), 2000)
    await setMtime(join(tree.root, 'p', `${NEW_ID}.jsonl`), 1000)

    const newest = await findNewestTranscript(join(tree.root, 'p'))

    expect(newest).toMatchObject({
      path: join(tree.root, 'p', `${OLD_ID}.jsonl`),
      mtimeMs: 2_000_000
    })
  })

  it('reports the file size beside the path and modification time', async () => {
    tree = await buildDiscoveryTree({ files: { [`p/${OLD_ID}.jsonl`]: 'abc\n' } })

    expect((await findNewestTranscript(join(tree.root, 'p')))?.size).toBe(4)
  })

  it('breaks a modification-time tie by the lower file name', async () => {
    tree = await buildDiscoveryTree({
      files: { [`p/${TIE_ID}.jsonl`]: 'a\n', [`p/${NEW_ID}.jsonl`]: 'b\n' }
    })
    await setMtime(join(tree.root, 'p', `${TIE_ID}.jsonl`), 1000)
    await setMtime(join(tree.root, 'p', `${NEW_ID}.jsonl`), 1000)

    const newest = await findNewestTranscript(join(tree.root, 'p'))

    expect(newest?.path).toBe(join(tree.root, 'p', `${NEW_ID}.jsonl`))
  })

  it('ignores a transcript inside a subfolder', async () => {
    tree = await buildDiscoveryTree({
      files: { [`p/${OLD_ID}.jsonl`]: 'a\n', [`p/${OLD_ID}/subagents/${NEW_ID}.jsonl`]: 'b\n' }
    })
    await setMtime(join(tree.root, 'p', OLD_ID, 'subagents', `${NEW_ID}.jsonl`), 9000)
    await setMtime(join(tree.root, 'p', `${OLD_ID}.jsonl`), 1000)

    const newest = await findNewestTranscript(join(tree.root, 'p'))

    expect(newest?.path).toBe(join(tree.root, 'p', `${OLD_ID}.jsonl`))
  })

  it('ignores a symlinked transcript, as session discovery does', async () => {
    tree = await buildDiscoveryTree({
      files: { [`p/${OLD_ID}.jsonl`]: 'a\n', 'elsewhere/real.jsonl': 'b\n' },
      symlinks: { [`p/${NEW_ID}.jsonl`]: join('..', 'elsewhere', 'real.jsonl') }
    })
    await setMtime(join(tree.root, 'elsewhere', 'real.jsonl'), 9000)
    await setMtime(join(tree.root, 'p', `${OLD_ID}.jsonl`), 1000)

    const newest = await findNewestTranscript(join(tree.root, 'p'))

    expect(newest?.path).toBe(join(tree.root, 'p', `${OLD_ID}.jsonl`))
  })

  it('ignores files that are not session transcripts', async () => {
    tree = await buildDiscoveryTree({ files: { 'p/notes.jsonl': 'a\n', 'p/.DS_Store': 'b' } })

    expect(await findNewestTranscript(join(tree.root, 'p'))).toBeNull()
  })

  it('returns null for a project with no transcripts', async () => {
    tree = await buildDiscoveryTree({})
    await mkdir(join(tree.root, 'p'))

    expect(await findNewestTranscript(join(tree.root, 'p'))).toBeNull()
  })

  it('returns null when the project folder does not exist', async () => {
    tree = await buildDiscoveryTree({})

    expect(await findNewestTranscript(join(tree.root, 'missing'))).toBeNull()
  })

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'rejects with the system error when the project folder cannot be read',
    async () => {
      tree = await buildDiscoveryTree({ files: { [`p/${OLD_ID}.jsonl`]: 'a\n' } })
      await chmod(join(tree.root, 'p'), 0o000)

      try {
        await expect(findNewestTranscript(join(tree.root, 'p'))).rejects.toMatchObject({
          code: 'EACCES'
        })
      } finally {
        await chmod(join(tree.root, 'p'), 0o700)
      }
    }
  )
})
