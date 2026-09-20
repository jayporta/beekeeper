import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { statTranscriptFile } from '../statTranscriptFile'
import { buildDiscoveryTree, type DiscoveryTree } from '../testDiscoveryTree'
import type { ThrowingLstatState } from '../testThrowingLstat'

const throwingLstatState = vi.hoisted<ThrowingLstatState>(() => ({
  throwForPath: undefined,
  throwError: undefined
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  const { withThrowingLstat } = await import('../testThrowingLstat')
  return { ...actual, lstat: withThrowingLstat(actual.lstat, throwingLstatState) }
})

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
  throwingLstatState.throwForPath = undefined
  throwingLstatState.throwError = undefined
})

describe('statTranscriptFile', () => {
  it('returns null when the file has vanished', async () => {
    tree = await buildDiscoveryTree({})

    expect(await statTranscriptFile(join(tree.root, 'missing.jsonl'))).toBeNull()
  })

  it('returns null when the path is a directory', async () => {
    tree = await buildDiscoveryTree({ files: { 'folder.jsonl/placeholder': '' } })

    expect(await statTranscriptFile(join(tree.root, 'folder.jsonl'))).toBeNull()
  })

  it('returns null when the path is a symlink to a regular file', async () => {
    tree = await buildDiscoveryTree({
      files: { 'target.jsonl': 'content' },
      symlinks: { 'link.jsonl': 'target.jsonl' }
    })

    expect(await statTranscriptFile(join(tree.root, 'link.jsonl'))).toBeNull()
  })

  it('rejects when lstat fails for a reason other than missing', async () => {
    tree = await buildDiscoveryTree({ files: { 'session.jsonl': 'content' } })
    const filePath = join(tree.root, 'session.jsonl')
    throwingLstatState.throwForPath = filePath
    throwingLstatState.throwError = Object.assign(new Error('input/output error'), { code: 'EIO' })

    await expect(statTranscriptFile(filePath)).rejects.toMatchObject({ code: 'EIO' })
  })
})
