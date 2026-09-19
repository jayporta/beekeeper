import { chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { isRealDirectory } from '../isRealDirectory'
import { buildDiscoveryTree, type DiscoveryTree } from '../testDiscoveryTree'

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
})

describe('isRealDirectory', () => {
  it('returns true for a real directory', async () => {
    tree = await buildDiscoveryTree({ files: { 'dir/placeholder': '' } })

    expect(await isRealDirectory(join(tree.root, 'dir'))).toBe(true)
  })

  it('returns false for a file', async () => {
    tree = await buildDiscoveryTree({ files: { 'file.txt': '' } })

    expect(await isRealDirectory(join(tree.root, 'file.txt'))).toBe(false)
  })

  it('returns false for a symlink to a directory', async () => {
    tree = await buildDiscoveryTree({
      files: { 'real-dir/placeholder': '' },
      symlinks: { 'linked-dir': 'real-dir' }
    })

    expect(await isRealDirectory(join(tree.root, 'linked-dir'))).toBe(false)
  })

  it('returns false when the path does not exist', async () => {
    tree = await buildDiscoveryTree({})

    expect(await isRealDirectory(join(tree.root, 'missing'))).toBe(false)
  })

  it.skipIf(process.getuid?.() === 0)(
    'rejects when lstat fails for a reason other than missing',
    async () => {
      tree = await buildDiscoveryTree({ files: { 'parent/child/placeholder': '' } })
      const parentDir = join(tree.root, 'parent')
      const childDir = join(parentDir, 'child')

      try {
        await chmod(parentDir, 0o600)
        await expect(isRealDirectory(childDir)).rejects.toMatchObject({ code: 'EACCES' })
      } finally {
        await chmod(parentDir, 0o755)
      }
    }
  )
})
