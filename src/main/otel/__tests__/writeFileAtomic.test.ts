import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeFileAtomic } from '../writeFileAtomic'

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-atomic-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('writeFileAtomic', () => {
  it('writes the text with the owner-only mode', async () => {
    const target = join(dir, 'a.json')

    await writeFileAtomic(target, 'hello')

    expect([readFileSync(target, 'utf8'), statSync(target).mode & 0o777]).toEqual(['hello', 0o600])
  })

  it('replaces an existing file and narrows its mode', async () => {
    const target = join(dir, 'a.json')
    writeFileSync(target, 'old', { mode: 0o644 })

    await writeFileAtomic(target, 'new')

    expect([readFileSync(target, 'utf8'), statSync(target).mode & 0o777]).toEqual(['new', 0o600])
  })

  it('leaves only the target in the folder', async () => {
    await writeFileAtomic(join(dir, 'a.json'), 'hello')

    expect(readdirSync(dir)).toEqual(['a.json'])
  })

  it('rejects and removes its temporary file when the target cannot be replaced', async () => {
    const target = join(dir, 'a.json')
    mkdirSync(join(target, 'blocker'), { recursive: true })

    await expect(writeFileAtomic(target, 'hello')).rejects.toThrow()
    expect(readdirSync(dir)).toEqual(['a.json'])
  })

  it('rejects when the folder does not exist', async () => {
    await expect(writeFileAtomic(join(dir, 'missing', 'a.json'), 'hello')).rejects.toThrow()
  })
})
