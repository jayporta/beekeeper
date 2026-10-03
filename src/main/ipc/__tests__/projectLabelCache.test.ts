import { appendFile, chmod, rm, symlink, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { toProjectDirName } from '../../../core/transcript/ids'
import { readCwdLabel } from '../../../core/transcript/readCwdLabel'
import { buildDiscoveryTree, type DiscoveryTree } from '../../../core/transcript/testDiscoveryTree'
import { buildCwdRecord, buildJsonlText } from '../../../core/transcript/testFixtures'
import { MAX_CONCURRENT_LABELS, createProjectLabelCache } from '../projectLabelCache'

const idOf = (n: number): string => {
  const digit = String(n)
  return `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`
}
const FIRST_ID = idOf(1)
const canChmod = process.platform !== 'win32' && process.getuid?.() !== 0

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

/** A transcript that records no working directory. */
const noCwd = buildJsonlText([{ type: 'summary' }])

/** The fixed modification time, in seconds, that tests pin files and folders to. */
const PINNED_SECONDS = 1000

/** Pins a path's modification time. */
const pin = (path: string, seconds = PINNED_SECONDS): Promise<void> =>
  utimes(path, seconds, seconds)

/** Builds project `a` with one transcript holding `text`, the folder and file both pinned. */
async function buildPinnedTree(text: string): Promise<DiscoveryTree> {
  const built = await buildDiscoveryTree({ files: { [`a/${FIRST_ID}.jsonl`]: text } })
  await pin(join(built.root, 'a'))
  await pin(join(built.root, 'a', `${FIRST_ID}.jsonl`))
  return built
}

const transcriptOf = (built: DiscoveryTree, id = FIRST_ID): string =>
  join(built.root, 'a', `${id}.jsonl`)

/** A cache whose transcript reads and log lines are recorded. */
function recordingCache(): {
  cache: ReturnType<typeof createProjectLabelCache>
  reads: string[]
  logs: string[]
} {
  const reads: string[] = []
  const logs: string[] = []
  const cache = createProjectLabelCache({
    log: (line) => logs.push(line),
    readLabel: (path) => {
      reads.push(path)
      return readCwdLabel(path)
    }
  })
  return { cache, reads, logs }
}

describe('createProjectLabelCache', () => {
  it('labels each project from its transcript', async () => {
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
      files: { [`b/${FIRST_ID}.jsonl`]: noCwd, 'a/notes.txt': 'x' }
    })

    const labels = await createProjectLabelCache().labelsFor([entry(tree, 'a'), entry(tree, 'b')])

    expect(Object.fromEntries(labels)).toEqual({ a: null, b: null })
  })

  describe('which transcripts are read', () => {
    it('stops after the first transcript that records a cwd', async () => {
      tree = await buildDiscoveryTree({
        files: {
          [`a/${idOf(1)}.jsonl`]: recording('/Users/dev/proj1'),
          [`a/${idOf(2)}.jsonl`]: recording('/Users/dev/other')
        }
      })
      const { cache, reads } = recordingCache()

      const labels = await cache.labelsFor([entry(tree, 'a')])

      expect(labels.get('a')).toBe('proj1')
      expect(reads).toEqual([transcriptOf(tree, idOf(1))])
    })

    it('goes on to the next transcript when one records no cwd', async () => {
      tree = await buildDiscoveryTree({
        files: {
          [`a/${idOf(1)}.jsonl`]: noCwd,
          [`a/${idOf(2)}.jsonl`]: recording('/Users/dev/proj2')
        }
      })

      const labels = await createProjectLabelCache().labelsFor([entry(tree, 'a')])

      expect(labels.get('a')).toBe('proj2')
    })

    it('reads at most three transcripts', async () => {
      tree = await buildDiscoveryTree({
        files: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`a/${idOf(n)}.jsonl`, noCwd]))
      })
      const { cache, reads } = recordingCache()

      await cache.labelsFor([entry(tree, 'a')])

      expect(reads).toEqual([1, 2, 3].map((n) => transcriptOf(tree as DiscoveryTree, idOf(n))))
    })

    it('reads no symlinked or non-session file', async () => {
      tree = await buildDiscoveryTree({
        files: {
          'a/notes.jsonl': recording('/Users/dev/notes'),
          'elsewhere/real.jsonl': recording('/x/real')
        }
      })
      await symlink(
        join(tree.root, 'elsewhere', 'real.jsonl'),
        join(tree.root, 'a', `${idOf(1)}.jsonl`)
      )
      const { cache, reads } = recordingCache()

      const labels = await cache.labelsFor([entry(tree, 'a')])

      expect(labels.get('a')).toBeNull()
      expect(reads).toEqual([])
    })
  })

  describe('a label that was found', () => {
    it('is returned with no filesystem access', async () => {
      tree = await buildPinnedTree(recording('/Users/dev/proj1'))
      const cache = createProjectLabelCache()
      await cache.labelsFor([entry(tree, 'a')])
      await rm(join(tree.root, 'a'), { recursive: true })

      const labels = await cache.labelsFor([entry(tree, 'a')])

      expect(labels.get('a')).toBe('proj1')
    })

    it('is forgotten once its project is no longer listed', async () => {
      tree = await buildPinnedTree(recording('/Users/dev/proj1'))
      const cache = createProjectLabelCache()
      await cache.labelsFor([entry(tree, 'a')])
      await cache.labelsFor([])
      await writeFile(transcriptOf(tree), recording('/Users/dev/proj2'))

      const labels = await cache.labelsFor([entry(tree, 'a')])

      expect(labels.get('a')).toBe('proj2')
    })
  })

  describe('a project with no label', () => {
    it('is not read again while its folder and transcripts are unchanged', async () => {
      tree = await buildPinnedTree(noCwd)
      const { cache, reads } = recordingCache()
      await cache.labelsFor([entry(tree, 'a')])

      await cache.labelsFor([entry(tree, 'a')])

      expect(reads).toHaveLength(1)
    })

    it('is read again when its folder modification time changes', async () => {
      tree = await buildPinnedTree(noCwd)
      const { cache, reads } = recordingCache()
      await cache.labelsFor([entry(tree, 'a')])
      await pin(join(tree.root, 'a'), 5000)

      await cache.labelsFor([entry(tree, 'a')])

      expect(reads).toHaveLength(2)
    })

    it('gets its label once a transcript is added to its folder', async () => {
      tree = await buildDiscoveryTree({ files: { 'a/notes.txt': 'x' } })
      await pin(join(tree.root, 'a'))
      const cache = createProjectLabelCache()
      await cache.labelsFor([entry(tree, 'a')])
      await writeFile(transcriptOf(tree), recording('/Users/dev/proj1'))
      await pin(join(tree.root, 'a'), 5000)

      const labels = await cache.labelsFor([entry(tree, 'a')])

      expect(labels.get('a')).toBe('proj1')
    })

    it('gets its label when a transcript that was read grows, with the folder unchanged', async () => {
      tree = await buildPinnedTree(noCwd)
      const cache = createProjectLabelCache()
      await cache.labelsFor([entry(tree, 'a')])
      await appendFile(transcriptOf(tree), recording('/Users/dev/proj1'))
      await pin(join(tree.root, 'a'))

      const labels = await cache.labelsFor([entry(tree, 'a')])

      expect(labels.get('a')).toBe('proj1')
    })

    it('is read again when a transcript that was read changes modification time, with the same size', async () => {
      tree = await buildPinnedTree(noCwd)
      const { cache, reads } = recordingCache()
      await cache.labelsFor([entry(tree, 'a')])
      await pin(transcriptOf(tree), 5000)

      await cache.labelsFor([entry(tree, 'a')])

      expect(reads).toHaveLength(2)
    })
  })

  describe.skipIf(!canChmod)('a failed read', () => {
    it('is logged by its code and position, never by a name or path', async () => {
      tree = await buildPinnedTree(recording('/Users/dev/proj1'))
      await chmod(transcriptOf(tree), 0o000)
      const { cache, logs } = recordingCache()

      try {
        await cache.labelsFor([entry(tree, 'a')])
      } finally {
        await chmod(transcriptOf(tree), 0o600)
      }

      expect(logs).toEqual(['Beekeeper could not read the label of project 1 of 1 (EACCES).'])
    })

    it('gives null, and is not tried again until a transcript that was read changes', async () => {
      tree = await buildPinnedTree(recording('/Users/dev/proj1'))
      await chmod(transcriptOf(tree), 0o000)
      const { cache, reads } = recordingCache()

      try {
        await cache.labelsFor([entry(tree, 'a')])
        const second = await cache.labelsFor([entry(tree, 'a')])
        expect([second.get('a'), reads]).toEqual([null, [transcriptOf(tree)]])
      } finally {
        await chmod(transcriptOf(tree), 0o600)
      }
      await pin(transcriptOf(tree), 5000)

      const third = await cache.labelsFor([entry(tree, 'a')])

      expect(third.get('a')).toBe('proj1')
    })

    it('is logged once, then not tried again, for a folder that cannot be listed', async () => {
      tree = await buildPinnedTree(recording('/Users/dev/proj1'))
      await chmod(join(tree.root, 'a'), 0o000)
      const { cache, logs } = recordingCache()

      try {
        await cache.labelsFor([entry(tree, 'a')])
        await cache.labelsFor([entry(tree, 'a')])
      } finally {
        await chmod(join(tree.root, 'a'), 0o700)
      }

      expect(logs).toHaveLength(1)
    })

    it('is retried once the folder modification time changes', async () => {
      tree = await buildPinnedTree(recording('/Users/dev/proj1'))
      await chmod(join(tree.root, 'a'), 0o000)
      const cache = createProjectLabelCache({ log: () => undefined })
      try {
        await cache.labelsFor([entry(tree, 'a')])
      } finally {
        await chmod(join(tree.root, 'a'), 0o700)
      }
      await pin(join(tree.root, 'a'), 5000)

      const labels = await cache.labelsFor([entry(tree, 'a')])

      expect(labels.get('a')).toBe('proj1')
    })
  })

  it('logs and gives null for a project whose folder is gone, and retries it next call', async () => {
    tree = await buildDiscoveryTree({})
    const { cache, logs } = recordingCache()

    const labels = await cache.labelsFor([entry(tree, 'gone')])

    expect([labels.get('gone'), logs]).toEqual([
      null,
      ['Beekeeper could not read the label of project 1 of 1 (ENOENT).']
    ])
  })

  describe('with many projects', () => {
    const names = Array.from({ length: 12 }, (_, index) => `p${index}`)

    async function buildMany(): Promise<DiscoveryTree> {
      return buildDiscoveryTree({
        files: Object.fromEntries(
          names.map((name) => [`${name}/${FIRST_ID}.jsonl`, recording(`/Users/dev/label-${name}`)])
        )
      })
    }

    it('labels every project, in the order listed', async () => {
      tree = await buildMany()

      const labels = await createProjectLabelCache().labelsFor(
        names.map((n) => entry(tree as DiscoveryTree, n))
      )

      expect([...labels]).toEqual(names.map((name) => [name, `label-${name}`]))
    })

    it('reads no more than the concurrency limit at once', async () => {
      tree = await buildMany()
      let running = 0
      let peak = 0
      const cache = createProjectLabelCache({
        readLabel: async (path) => {
          running += 1
          peak = Math.max(peak, running)
          await new Promise((resolve) => setTimeout(resolve, 5))
          running -= 1
          return readCwdLabel(path)
        }
      })

      await cache.labelsFor(names.map((n) => entry(tree as DiscoveryTree, n)))

      expect(peak).toBeGreaterThan(1)
      expect(peak).toBeLessThanOrEqual(MAX_CONCURRENT_LABELS)
    })
  })
})
