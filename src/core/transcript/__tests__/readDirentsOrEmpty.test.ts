import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readDirentsOrEmpty } from '../readDirentsOrEmpty'
import { buildDiscoveryTree, type DiscoveryTree } from '../testDiscoveryTree'

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
})

describe('readDirentsOrEmpty', () => {
  it('returns the entries of an existing directory', async () => {
    tree = await buildDiscoveryTree({ files: { 'dir/a.txt': '', 'dir/b.txt': '' } })

    const dirents = await readDirentsOrEmpty(join(tree.root, 'dir'))

    expect(dirents.map((d) => d.name).sort()).toEqual(['a.txt', 'b.txt'])
  })

  it('returns an empty array when the directory does not exist', async () => {
    tree = await buildDiscoveryTree({})

    const dirents = await readDirentsOrEmpty(join(tree.root, 'missing'))

    expect(dirents).toEqual([])
  })
})
