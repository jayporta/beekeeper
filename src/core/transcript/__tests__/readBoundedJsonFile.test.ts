import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { err, ok } from '../../shared/result'
import { readBoundedJsonFile } from '../readBoundedJsonFile'
import { buildDiscoveryTree, type DiscoveryTree } from '../testDiscoveryTree'

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
})

describe('readBoundedJsonFile', () => {
  it('returns the parsed JSON of a small file', async () => {
    tree = await buildDiscoveryTree({ files: { 'a.json': '{"name":"scan","n":[1,2]}' } })

    expect(await readBoundedJsonFile(join(tree.root, 'a.json'), 1024)).toEqual(
      ok({ name: 'scan', n: [1, 2] })
    )
  })

  it('reports a file exactly at the cap as readable', async () => {
    tree = await buildDiscoveryTree({ files: { 'edge.json': `"${'a'.repeat(8)}"` } }) // 10 bytes

    expect(await readBoundedJsonFile(join(tree.root, 'edge.json'), 10)).toEqual(ok('aaaaaaaa'))
  })

  it('reports an absent path as missing', async () => {
    tree = await buildDiscoveryTree({})

    expect(await readBoundedJsonFile(join(tree.root, 'absent.json'), 1024)).toEqual(
      err({ reason: 'missing' })
    )
  })

  it('reports a symlink as a symlink rather than following it', async () => {
    tree = await buildDiscoveryTree({
      files: { 'real.json': '{}' },
      symlinks: { 'link.json': 'real.json' }
    })

    expect(await readBoundedJsonFile(join(tree.root, 'link.json'), 1024)).toEqual(
      err({ reason: 'symlink' })
    )
  })

  it('reports a directory as not-a-file', async () => {
    tree = await buildDiscoveryTree({ files: { 'dir/inner.json': '{}' } })

    expect(await readBoundedJsonFile(join(tree.root, 'dir'), 1024)).toEqual(
      err({ reason: 'not-a-file' })
    )
  })

  it('reports a file one byte over the cap as too-large', async () => {
    tree = await buildDiscoveryTree({ files: { 'big.json': `"${'a'.repeat(9)}"` } }) // 11 bytes

    expect(await readBoundedJsonFile(join(tree.root, 'big.json'), 10)).toEqual(
      err({ reason: 'too-large' })
    )
  })

  it('reports unparseable content as invalid-json', async () => {
    tree = await buildDiscoveryTree({ files: { 'bad.json': '{' } })

    expect(await readBoundedJsonFile(join(tree.root, 'bad.json'), 1024)).toEqual(
      err({ reason: 'invalid-json' })
    )
  })
})
