import { chmod, rm, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { toProjectDirName } from '../../../core/transcript/ids'
import { buildDiscoveryTree, type DiscoveryTree } from '../../../core/transcript/testDiscoveryTree'
import { buildCwdRecord, buildJsonlText } from '../../../core/transcript/testFixtures'
import { createProjectLabelCache } from '../projectLabelCache'

const FIRST_ID = '11111111-1111-4111-8111-111111111111'

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
})

function entry(
  tree: DiscoveryTree,
  dirName: string
): { dirName: ReturnType<typeof toProjectDirName>; path: string } {
  return { dirName: toProjectDirName(dirName), path: join(tree.root, dirName) }
}

/** The transcript text recording `cwd`. */
const recording = (cwd: string): string => buildJsonlText([buildCwdRecord(cwd)])

/** The fixed modification time, in seconds, that tests pin a transcript to. */
const PINNED_SECONDS = 1000

/** Builds a project `a` whose one transcript records `cwd` (none when `null`) and has the pinned modification time. */
async function buildPinnedTree(cwd: string | null): Promise<DiscoveryTree> {
  const text = cwd === null ? buildJsonlText([{ type: 'summary' }]) : recording(cwd)
  const built = await buildDiscoveryTree({ files: { [`a/${FIRST_ID}.jsonl`]: text } })
  await utimes(join(built.root, 'a'), PINNED_SECONDS, PINNED_SECONDS)
  await utimes(join(built.root, 'a', `${FIRST_ID}.jsonl`), PINNED_SECONDS, PINNED_SECONDS)
  return built
}

/** Writes `content` to a file and pins its modification time, so a rewrite can keep it exactly. */
async function writePinned(path: string, content: string): Promise<void> {
  await writeFile(path, content)
  await utimes(path, PINNED_SECONDS, PINNED_SECONDS)
}

describe('createProjectLabelCache', () => {
  it('labels each project from its newest transcript', async () => {
    tree = await buildDiscoveryTree({
      files: {
        [`a/${FIRST_ID}.jsonl`]: recording('/Users/dev/acme-web'),
        [`b/${FIRST_ID}.jsonl`]: recording('/Users/dev/api')
      }
    })

    const labels = await createProjectLabelCache().labelsFor([entry(tree, 'a'), entry(tree, 'b')])

    expect(Object.fromEntries(labels)).toEqual({ a: 'acme-web', b: 'api' })
  })

  it('gives null to a project with no transcript and to one that records no cwd', async () => {
    tree = await buildDiscoveryTree({
      files: { [`b/${FIRST_ID}.jsonl`]: buildJsonlText([{ type: 'summary' }]), 'a/notes.txt': 'x' }
    })

    const labels = await createProjectLabelCache().labelsFor([entry(tree, 'a'), entry(tree, 'b')])

    expect(Object.fromEntries(labels)).toEqual({ a: null, b: null })
  })

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'gives null to a project folder it cannot read, and labels it once it can',
    async () => {
      tree = await buildDiscoveryTree({
        files: { [`a/${FIRST_ID}.jsonl`]: recording('/Users/dev/acme-web') }
      })
      const cache = createProjectLabelCache()
      await chmod(join(tree.root, 'a'), 0o000)

      let unreadable: ReadonlyMap<string, string | null>
      try {
        unreadable = await cache.labelsFor([entry(tree, 'a')])
      } finally {
        await chmod(join(tree.root, 'a'), 0o700)
      }
      const readable = await cache.labelsFor([entry(tree, 'a')])

      expect([unreadable.get('a'), readable.get('a')]).toEqual([null, 'acme-web'])
    }
  )

  it('returns a label it already read with no filesystem access', async () => {
    tree = await buildPinnedTree('/Users/dev/proj1')
    const cache = createProjectLabelCache()
    await cache.labelsFor([entry(tree, 'a')])
    await rm(join(tree.root, 'a'), { recursive: true })

    const labels = await cache.labelsFor([entry(tree, 'a')])

    expect(labels.get('a')).toBe('proj1')
  })

  it('does not retry a null label while the folder modification time is unchanged', async () => {
    tree = await buildPinnedTree(null)
    const path = join(tree.root, 'a', `${FIRST_ID}.jsonl`)
    const cache = createProjectLabelCache()
    await cache.labelsFor([entry(tree, 'a')])
    await writePinned(path, recording('/Users/dev/proj1'))

    const labels = await cache.labelsFor([entry(tree, 'a')])

    expect(labels.get('a')).toBeNull()
  })

  it('retries a null label once the folder modification time changes', async () => {
    tree = await buildPinnedTree(null)
    const path = join(tree.root, 'a', `${FIRST_ID}.jsonl`)
    const cache = createProjectLabelCache()
    await cache.labelsFor([entry(tree, 'a')])
    await writePinned(path, recording('/Users/dev/proj1'))
    await utimes(join(tree.root, 'a'), 5000, 5000)

    const labels = await cache.labelsFor([entry(tree, 'a')])

    expect(labels.get('a')).toBe('proj1')
  })

  it('labels a project once a transcript is added to its empty folder', async () => {
    tree = await buildDiscoveryTree({ files: { 'a/notes.txt': 'x' } })
    await utimes(join(tree.root, 'a'), PINNED_SECONDS, PINNED_SECONDS)
    const cache = createProjectLabelCache()
    await cache.labelsFor([entry(tree, 'a')])
    await writeFile(join(tree.root, 'a', `${FIRST_ID}.jsonl`), recording('/Users/dev/proj1'))
    await utimes(join(tree.root, 'a'), 5000, 5000)

    const labels = await cache.labelsFor([entry(tree, 'a')])

    expect(labels.get('a')).toBe('proj1')
  })

  it('forgets a project that is no longer listed', async () => {
    tree = await buildPinnedTree('/Users/dev/proj1')
    const cache = createProjectLabelCache()
    await cache.labelsFor([entry(tree, 'a')])
    await cache.labelsFor([])
    await writePinned(join(tree.root, 'a', `${FIRST_ID}.jsonl`), recording('/Users/dev/proj2'))

    const labels = await cache.labelsFor([entry(tree, 'a')])

    expect(labels.get('a')).toBe('proj2')
  })
})
