import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { open, type FileHandle } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readSubagentMeta } from '../readSubagentMeta'
import { buildMinimalSubagentMeta, buildSubagentMeta } from '../testFixtures'

// Wraps the real `open` in a spy so individual tests can intercept the
// `FileHandle` it returns and control how its `read` calls behave, without
// touching any other `node:fs/promises` export.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, open: vi.fn(actual.open) }
})

/**
 * Replaces the next `open` call with one that opens the real file but caps
 * every `read` to at most `maxChunkBytes`, forcing
 * {@link readSubagentMeta}'s read loop through several short reads instead
 * of one that happens to return everything at once.
 */
async function mockNextOpenWithChunkedReads(maxChunkBytes: number): Promise<void> {
  const actualOpen = (await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises'))
    .open

  vi.mocked(open).mockImplementationOnce(async (...args) => {
    const handle = await actualOpen(...args)
    const originalRead = handle.read.bind(handle)
    vi.spyOn(handle, 'read').mockImplementation((async (
      buffer: NodeJS.ArrayBufferView,
      offset: number,
      length: number,
      position: number
    ) =>
      originalRead(
        buffer,
        offset,
        Math.min(length, maxChunkBytes),
        position
      )) as FileHandle['read'])
    return handle
  })
}

/**
 * Replaces the next `open` call with one whose `read` never signals end of
 * file: every call fills the requested length with fabricated bytes, as if
 * the file kept growing past what `fstat` reported before the read loop
 * finished.
 */
async function mockNextOpenWithUnendingReads(): Promise<void> {
  const actualOpen = (await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises'))
    .open

  vi.mocked(open).mockImplementationOnce(async (...args) => {
    const handle = await actualOpen(...args)
    vi.spyOn(handle, 'read').mockImplementation((async (
      buffer: Buffer,
      offset: number,
      length: number
    ) => {
      buffer.fill(0x78, offset, offset + length)
      return { bytesRead: length, buffer }
    }) as FileHandle['read'])
    return handle
  })
}

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-subagent-meta-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeMeta(name: string, content: string): string {
  const path = join(dir, name)
  writeFileSync(path, content, 'utf-8')
  return path
}

describe('readSubagentMeta', () => {
  it('reads a well-formed meta file', async () => {
    const path = writeMeta(
      'agent-a.meta.json',
      JSON.stringify(buildMinimalSubagentMeta('code-reviewer'))
    )

    const result = await readSubagentMeta(path)

    expect(result).toEqual({ ok: true, value: { agentType: 'code-reviewer' } })
  })

  it('reports missing when the file does not exist', async () => {
    const result = await readSubagentMeta(join(dir, 'agent-missing.meta.json'))

    expect(result).toEqual({ ok: false, error: { reason: 'missing' } })
  })

  it('reports too-large when the file exceeds the 64 KiB cap', async () => {
    const oversized = JSON.stringify(
      buildSubagentMeta({ extra: { padding: 'x'.repeat(70 * 1024) } })
    )
    const path = writeMeta('agent-big.meta.json', oversized)

    const result = await readSubagentMeta(path)

    expect(result).toEqual({ ok: false, error: { reason: 'too-large' } })
  })

  it('reports invalid-json when the file is not parseable JSON', async () => {
    const path = writeMeta('agent-broken.meta.json', '{ not json')

    const result = await readSubagentMeta(path)

    expect(result).toEqual({ ok: false, error: { reason: 'invalid-json' } })
  })

  it('reports invalid-shape when the JSON fails schema validation', async () => {
    const path = writeMeta(
      'agent-shapeless.meta.json',
      JSON.stringify({ description: 'no agentType' })
    )

    const result = await readSubagentMeta(path)

    expect(result).toEqual({ ok: false, error: { reason: 'invalid-shape' } })
  })

  it('reports not-a-file when the path is a directory', async () => {
    const result = await readSubagentMeta(dir)

    expect(result).toEqual({ ok: false, error: { reason: 'not-a-file' } })
  })

  it('reports not-a-file for a FIFO, on platforms where mkfifo is available', async () => {
    const path = join(dir, 'agent-fifo.meta.json')
    try {
      execFileSync('mkfifo', [path])
    } catch {
      return
    }

    const result = await readSubagentMeta(path)

    expect(result).toEqual({ ok: false, error: { reason: 'not-a-file' } })
  })

  it('reports symlink when the path is a symlink, rather than following it', async () => {
    const targetPath = writeMeta('agent-real.meta.json', JSON.stringify(buildMinimalSubagentMeta()))
    const linkPath = join(dir, 'agent-link.meta.json')
    symlinkSync(targetPath, linkPath)

    const result = await readSubagentMeta(linkPath)

    expect(result).toEqual({ ok: false, error: { reason: 'symlink' } })
  })

  it('rejects when the file cannot be opened for a reason other than missing or a symlink', async () => {
    const path = writeMeta('agent-locked.meta.json', JSON.stringify(buildMinimalSubagentMeta()))
    chmodSync(path, 0o000)

    try {
      await expect(readSubagentMeta(path)).rejects.toMatchObject({ code: 'EACCES' })
    } finally {
      chmodSync(path, 0o600)
    }
  })

  it('assembles a meta file delivered across several short reads', async () => {
    const path = writeMeta(
      'agent-chunked.meta.json',
      JSON.stringify(buildMinimalSubagentMeta('code-reviewer'))
    )
    await mockNextOpenWithChunkedReads(4)

    const result = await readSubagentMeta(path)

    expect(result).toEqual({ ok: true, value: { agentType: 'code-reviewer' } })
  })

  it('reports too-large when the file yields more bytes than fstat reported', async () => {
    const path = writeMeta('agent-grows.meta.json', 'x'.repeat(50))
    await mockNextOpenWithUnendingReads()

    const result = await readSubagentMeta(path)

    expect(result).toEqual({ ok: false, error: { reason: 'too-large' } })
  })
})
