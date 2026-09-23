import { describe, expect, it } from 'vitest'
import { toGitBinary } from '../gitBinary'
import { runGit, type GitExecFn, type GitExecOptions } from '../runGit'

const git = toGitBinary('/fake/git')

interface Call {
  file: string
  args: readonly string[]
  options: GitExecOptions
}

function recordingExec(calls: Call[]): GitExecFn {
  return (file, args, options) => {
    calls.push({ file, args, options })
    return Promise.resolve({ stdout: Buffer.from('out') })
  }
}

function failingExec(error: object): GitExecFn {
  return () => Promise.reject(Object.assign(new Error('secret /path'), error))
}

describe('runGit', () => {
  it('prepends the safety config and -C before the arguments', async () => {
    const calls: Call[] = []
    await runGit({ git, dir: '/repo', args: ['rev-parse', 'HEAD'], exec: recordingExec(calls) })
    expect(calls[0]?.file).toBe('/fake/git')
    expect(calls[0]?.args).toEqual([
      '--no-lazy-fetch',
      '-c',
      'core.fsmonitor=false',
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'core.attributesFile=/dev/null',
      '-c',
      'core.untrackedCache=false',
      '-c',
      'protocol.allow=never',
      '-c',
      'protocol.ext.allow=never',
      '-c',
      'protocol.file.allow=never',
      '-c',
      'protocol.ssh.allow=never',
      '-c',
      'protocol.http.allow=never',
      '-c',
      'protocol.https.allow=never',
      '-c',
      'protocol.git.allow=never',
      '-C',
      '/repo',
      'rev-parse',
      'HEAD'
    ])
  })

  it('passes a scrubbed environment without inherited git variables', async () => {
    const calls: Call[] = []
    process.env['GIT_DIR'] = '/elsewhere'
    try {
      await runGit({ git, dir: '/repo', args: ['diff'], exec: recordingExec(calls) })
    } finally {
      delete process.env['GIT_DIR']
    }
    const env = calls[0]?.options.env ?? {}
    expect(env).toMatchObject({
      GIT_OPTIONAL_LOCKS: '0',
      GIT_NO_LAZY_FETCH: '1',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
      GIT_PAGER: 'cat',
      LC_ALL: 'C'
    })
    expect(env).not.toHaveProperty('GIT_DIR')
    expect(env).not.toHaveProperty('GIT_WORK_TREE')
    expect(env).not.toHaveProperty('HOME')
  })

  it('asks for buffer output with a timeout and a size cap', async () => {
    const calls: Call[] = []
    await runGit({ git, dir: '/repo', args: ['diff'], exec: recordingExec(calls) })
    expect(calls[0]?.options).toMatchObject({ encoding: 'buffer' })
    expect(calls[0]?.options.timeout).toBeGreaterThan(0)
    expect(calls[0]?.options.maxBuffer).toBeGreaterThan(0)
  })

  it.each(['status', 'commit', 'checkout', 'config', '-c', '--exec-path', ''])(
    'throws for the unlisted subcommand %j',
    async (subcommand) => {
      await expect(
        runGit({ git, dir: '/repo', args: [subcommand], exec: recordingExec([]) })
      ).rejects.toThrow('git-subcommand-not-allowed')
    }
  )

  it.each([
    [['config', 'core.editor', 'vim']],
    [['config', '--get-regexp']],
    [['config', '--global', '--get-regexp', 'x']],
    [['config', '--unset', 'x', 'y']]
  ])('throws for config args %j', async (args) => {
    await expect(runGit({ git, dir: '/repo', args, exec: recordingExec([]) })).rejects.toThrow(
      'git-subcommand-not-allowed'
    )
  })

  it('allows the config --get-regexp read form', async () => {
    const result = await runGit({
      git,
      dir: '/repo',
      args: ['config', '--get-regexp', '^filter\\.'],
      exec: recordingExec([])
    })
    expect(result.ok).toBe(true)
  })

  it.each([
    [['diff', '--output=/tmp/x', 'abc']],
    [['diff', '--unknown-flag']],
    [['ls-files', '--others', '--exclude-from=/etc/passwd']],
    [['rev-parse', '--git-dir', 'x']],
    [['merge-base', '-a', 'x', 'y']]
  ])('throws for the flag in %j', async (args) => {
    await expect(runGit({ git, dir: '/repo', args, exec: recordingExec([]) })).rejects.toThrow(
      'git-option-not-allowed'
    )
  })

  it('does not inspect operands after --', async () => {
    const result = await runGit({
      git,
      dir: '/repo',
      args: ['diff', '--numstat', '--', '--output=x'],
      exec: recordingExec([])
    })
    expect(result.ok).toBe(true)
  })

  it('throws for a relative directory', async () => {
    await expect(
      runGit({ git, dir: 'repo', args: ['diff'], exec: recordingExec([]) })
    ).rejects.toThrow('git-dir-not-absolute')
  })

  it('throws when there are no arguments', async () => {
    await expect(runGit({ git, dir: '/repo', args: [], exec: recordingExec([]) })).rejects.toThrow(
      'git-subcommand-not-allowed'
    )
  })

  it('returns a non-zero exit code instead of an error', async () => {
    const result = await runGit({
      git,
      dir: '/repo',
      args: ['merge-base', 'a', 'b'],
      exec: failingExec({ code: 1, stdout: Buffer.from('') })
    })
    expect(result).toEqual({ ok: true, value: { exitCode: 1, stdout: Buffer.from('') } })
  })

  it('reports output over the cap as output-too-large', async () => {
    const result = await runGit({
      git,
      dir: '/repo',
      args: ['diff'],
      exec: failingExec({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', stdout: Buffer.from('cut') })
    })
    expect(result).toEqual({ ok: false, error: 'output-too-large' })
  })

  it('reports a killed process as a timeout', async () => {
    const result = await runGit({
      git,
      dir: '/repo',
      args: ['diff'],
      exec: failingExec({ killed: true, signal: 'SIGTERM', code: null })
    })
    expect(result).toEqual({ ok: false, error: 'timeout' })
  })

  it('reports a launch failure as spawn-failed without leaking the message', async () => {
    const result = await runGit({
      git,
      dir: '/repo',
      args: ['diff'],
      exec: failingExec({ code: 'ENOENT' })
    })
    expect(result).toEqual({ ok: false, error: 'spawn-failed' })
    expect(JSON.stringify(result)).not.toContain('secret')
  })
})
