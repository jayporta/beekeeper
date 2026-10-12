import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProcessPort } from '../../../core/io/processPort'
import type { ModHost } from '../../modHost'
import type { ProcessRequest } from '../../../core/io/processPort'
import { createTestHost } from '../../testHost'
import { createModProcessPort } from '../modProcessPort'

const REQUEST: ProcessRequest = {
  file: '/usr/bin/git',
  args: ['status'],
  env: { PATH: '/usr/bin', GIT_TRACE: '1' },
  timeoutMs: 5000,
  maxOutputBytes: 10
}

function portWith(
  answer: Parameters<typeof createTestHost>[0] = {},
  gitDisabled = false
): { host: ModHost; port: ProcessPort } {
  const host = createTestHost(answer)
  return { host, port: createModProcessPort({ host, platform: 'linux', gitDisabled }) }
}

describe('createModProcessPort run', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks the host to run the request with the git-isolating variables beside its env', async () => {
    const { host, port } = portWith()
    const runGit = vi.spyOn(host, 'runGit')

    await port.run(REQUEST)

    expect(runGit).toHaveBeenCalledWith({
      file: '/usr/bin/git',
      args: ['status'],
      env: {
        PATH: '/usr/bin',
        GIT_TRACE: '1',
        GIT_CONFIG_COUNT: '0',
        GIT_CONFIG_PARAMETERS: '',
        GIT_CEILING_DIRECTORIES: '',
        GIT_DISCOVERY_ACROSS_FILESYSTEM: '',
        GIT_LITERAL_PATHSPECS: '0',
        GIT_ICASE_PATHSPECS: '0',
        GIT_GLOB_PATHSPECS: '0',
        GIT_NOGLOB_PATHSPECS: '0',
        GIT_TRACE2: '0',
        GIT_TRACE2_EVENT: '0',
        GIT_TRACE2_PERF: '0',
        GIT_TRACE_PACKET: '0',
        GIT_TRACE_PERFORMANCE: '0',
        GIT_TRACE_SETUP: '0'
      },
      timeoutMs: 5000
    })
  })

  it('answers the exit code and the encoded stdout', async () => {
    const { port } = portWith({ git: { exitCode: 0, stdout: 'abc', isStdoutTruncated: false } })

    const result = await port.run(REQUEST)

    expect(result.ok && result.value.exitCode).toBe(0)
    expect(result.ok && new TextDecoder().decode(result.value.stdout)).toBe('abc')
  })

  it('treats a non-zero exit code as an outcome, not an error', async () => {
    const { port } = portWith({ git: { exitCode: 1, stdout: '', isStdoutTruncated: false } })

    const result = await port.run(REQUEST)

    expect(result.ok && result.value.exitCode).toBe(1)
  })

  it('reports output-too-large when the engine cut stdout', async () => {
    const { port } = portWith({ git: { exitCode: 0, stdout: 'ab', isStdoutTruncated: true } })

    expect(await port.run(REQUEST)).toEqual({ ok: false, error: 'output-too-large' })
  })

  it('reports output-too-large past maxOutputBytes, counted in bytes', async () => {
    // Six characters, twelve bytes in UTF-8: over 10 bytes, under 10 characters.
    const { port } = portWith({ git: { exitCode: 0, stdout: 'éééééé', isStdoutTruncated: false } })

    expect(await port.run(REQUEST)).toEqual({ ok: false, error: 'output-too-large' })
  })

  it('accepts output of exactly maxOutputBytes', async () => {
    const { port } = portWith({
      git: { exitCode: 0, stdout: '0123456789', isStdoutTruncated: false }
    })

    expect((await port.run(REQUEST)).ok).toBe(true)
  })

  it('reports spawn-failed when the run rejects quickly', async () => {
    const { host, port } = portWith()
    vi.spyOn(host, 'runGit').mockRejectedValue(new Error('boom at /secret/path'))

    expect(await port.run(REQUEST)).toEqual({ ok: false, error: 'spawn-failed' })
  })

  it('reports timeout when the run rejects after the timeout has passed', async () => {
    const { host, port } = portWith()
    vi.spyOn(host, 'runGit').mockRejectedValue(new Error('killed'))
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(5100)

    expect(await port.run(REQUEST)).toEqual({ ok: false, error: 'timeout' })
  })

  it('reports spawn-failed without running anything when git is disabled', async () => {
    const { host, port } = portWith({}, true)
    const runGit = vi.spyOn(host, 'runGit')

    expect(await port.run(REQUEST)).toEqual({ ok: false, error: 'spawn-failed' })
    expect(runGit).not.toHaveBeenCalled()
  })
})

describe('createModProcessPort isExecutable', () => {
  it('is true for a regular file', async () => {
    const { port } = portWith({ paths: { '/usr/bin/git': { kind: 'file' } } })

    expect(await port.isExecutable('/usr/bin/git')).toBe(true)
  })

  it('is false for a directory', async () => {
    const { port } = portWith({ paths: { '/usr/bin/git': { kind: 'dir' } } })

    expect(await port.isExecutable('/usr/bin/git')).toBe(false)
  })

  it('is false for a missing path', async () => {
    const { port } = portWith()

    expect(await port.isExecutable('/nope')).toBe(false)
  })
})

describe('createModProcessPort facts', () => {
  it('reports the platform it was given and inexact output', () => {
    const { port } = portWith()

    expect(port.platform).toBe('linux')
    expect(port.exactOutput).toBe(false)
  })
})
