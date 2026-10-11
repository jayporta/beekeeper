import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decodeUtf8 } from '../../../shared/decodeUtf8'
import { nodeProcess } from '../nodeProcess'

const BASE = { args: [], env: {}, timeoutMs: 10_000, maxOutputBytes: 1024 * 1024 }

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'beekeeper-node-process-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('nodeProcess.run', () => {
  it('gives the child exactly the requested environment', async () => {
    process.env['GIT_DIR'] = '/elsewhere'
    try {
      const result = await nodeProcess.run({ ...BASE, file: '/usr/bin/env', env: { ONLY: '1' } })

      expect(result.ok && decodeUtf8(result.value.stdout)).toBe('ONLY=1\n')
    } finally {
      delete process.env['GIT_DIR']
    }
  })

  it('returns a non-zero exit as an exit code, not an error', async () => {
    const result = await nodeProcess.run({ ...BASE, file: '/usr/bin/false' })

    expect(result.ok && result.value.exitCode).toBe(1)
  })

  it('reports output over the cap as output-too-large', async () => {
    const result = await nodeProcess.run({
      ...BASE,
      file: '/bin/echo',
      args: ['hello'],
      maxOutputBytes: 4
    })

    expect(result).toEqual({ ok: false, error: 'output-too-large' })
  })

  it('reports a missing program as spawn-failed', async () => {
    const result = await nodeProcess.run({ ...BASE, file: join(dir, 'missing') })

    expect(result).toEqual({ ok: false, error: 'spawn-failed' })
  })

  it('reports a program that outlives the timeout as timeout', async () => {
    const result = await nodeProcess.run({
      ...BASE,
      file: '/bin/sh',
      args: ['-c', 'sleep 5'],
      timeoutMs: 50
    })

    expect(result).toEqual({ ok: false, error: 'timeout' })
  })
})

describe('nodeProcess.isExecutable', () => {
  it('is true for an executable file', async () => {
    expect(await nodeProcess.isExecutable('/bin/sh')).toBe(true)
  })

  it('is false for a file without the execute bit', async () => {
    const path = join(dir, 'plain')
    await writeFile(path, 'x')
    await chmod(path, 0o644)

    expect(await nodeProcess.isExecutable(path)).toBe(false)
  })

  it('is false for a missing path', async () => {
    expect(await nodeProcess.isExecutable(join(dir, 'missing'))).toBe(false)
  })
})

describe('nodeProcess', () => {
  it('reports the host platform', () => {
    expect(nodeProcess.platform).toBe(process.platform)
  })

  it('returns the exact bytes of stdout', () => {
    expect(nodeProcess.exactOutput).toBe(true)
  })
})
