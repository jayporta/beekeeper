import { chmod, mkdir } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverProjects } from '../discoverProjects'
import { buildDiscoveryTree, type DiscoveryTree } from '../testDiscoveryTree'
import type { ReversedReaddirState } from '../testReversedReaddir'

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

describe('discoverProjects', () => {
  it('returns an empty array when the root does not exist', async () => {
    tree = await buildDiscoveryTree({})

    const projects = await discoverProjects(join(tree.root, 'missing-projects'))

    expect(projects).toEqual([])
  })

  it('returns an empty array for an empty projects directory', async () => {
    tree = await buildDiscoveryTree({})
    const emptyDir = join(tree.root, 'empty-projects')
    await mkdir(emptyDir)

    const projects = await discoverProjects(emptyDir)

    expect(projects).toEqual([])
  })

  it('skips a top-level entry that is a file, not a directory', async () => {
    tree = await buildDiscoveryTree({
      files: { 'not-a-project.txt': '', 'real-project/session-placeholder': '' }
    })

    const projects = await discoverProjects(tree.root)

    expect(projects.map((p) => p.dirName)).toEqual(['real-project'])
  })

  it('skips a top-level entry that is a symlink to a directory', async () => {
    tree = await buildDiscoveryTree({
      files: { 'real-project/session-placeholder': '', 'linked-target/session-placeholder': '' },
      symlinks: { 'linked-project': 'linked-target' }
    })

    const projects = await discoverProjects(tree.root)

    expect(projects.map((p) => p.dirName).sort()).toEqual(['linked-target', 'real-project'])
  })

  it('returns projects in code-unit order regardless of filesystem listing order', async () => {
    tree = await buildDiscoveryTree({
      files: {
        'zeta/session-placeholder': '',
        'alpha/session-placeholder': '',
        'Beta/session-placeholder': ''
      }
    })
    reversedReaddirState.reverseListingFor = tree.root

    const projects = await discoverProjects(tree.root)

    expect(projects.map((p) => p.dirName)).toEqual(['Beta', 'alpha', 'zeta'])
  })

  it('returns a folder name verbatim, including a leading dash', async () => {
    tree = await buildDiscoveryTree({
      files: { '-Users-jay-app/session-placeholder': '' }
    })

    const projects = await discoverProjects(tree.root)

    expect(projects).toEqual([
      { dirName: '-Users-jay-app', path: join(tree.root, '-Users-jay-app') }
    ])
  })

  it('resolves a relative projectsDir into absolute paths', async () => {
    tree = await buildDiscoveryTree({ files: { 'proj/session-placeholder': '' } })
    const relativeRoot = relative(process.cwd(), tree.root)

    const projects = await discoverProjects(relativeRoot)

    expect(projects).toHaveLength(1)
    expect(projects[0]?.path).toBe(join(tree.root, 'proj'))
    expect(isAbsolute(projects[0]?.path ?? '')).toBe(true)
  })

  it.skipIf(process.getuid?.() === 0)(
    'rejects when the projects directory cannot be read for a reason other than missing',
    async () => {
      tree = await buildDiscoveryTree({ files: { 'locked/session-placeholder': '' } })
      const lockedDir = join(tree.root, 'locked')

      try {
        await chmod(lockedDir, 0o000)
        await expect(discoverProjects(lockedDir)).rejects.toMatchObject({ code: 'EACCES' })
      } finally {
        await chmod(lockedDir, 0o755)
      }
    }
  )
})
