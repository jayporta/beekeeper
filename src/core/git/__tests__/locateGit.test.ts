import { describe, expect, it } from 'vitest'
import { locateGit } from '../locateGit'

const allExecutable = (): Promise<void> => Promise.resolve()

function executableOnly(...paths: string[]): (path: string) => Promise<void> {
  return (path) => (paths.includes(path) ? Promise.resolve() : Promise.reject(new Error('no')))
}

interface Runner {
  readonly ran: string[]
  readonly run: (file: string, args: readonly string[]) => Promise<string>
}

/**
 * A fake `run`: `--version` answers from `versions` (default 2.50.1), and
 * `xcode-select`/`xcrun` answer from `tools` (rejecting when it is `undefined`).
 */
function runner(
  options: {
    versions?: Record<string, string>
    tools?: { developerDir: string; git: string }
  } = {}
): Runner {
  const ran: string[] = []
  return {
    ran,
    run: (file, args) => {
      ran.push(file)
      if (args[0] === '--version') {
        return Promise.resolve(options.versions?.[file] ?? 'git version 2.50.1\n')
      }
      if (options.tools === undefined) return Promise.reject(new Error('no tools'))
      return Promise.resolve(file === '/usr/bin/xcrun' ? `${options.tools.git}\n` : '/clt\n')
    }
  }
}

describe('locateGit', () => {
  it('prefers the first executable candidate and only asks it for its version', async () => {
    const { ran, run } = runner()
    const result = await locateGit({
      candidates: ['/a/git', '/b/git'],
      platform: 'darwin',
      checkExecutable: allExecutable,
      run
    })
    expect(result).toEqual({ ok: true, value: '/a/git' })
    expect(ran).toEqual(['/a/git'])
  })

  it('skips a candidate that is not executable', async () => {
    const result = await locateGit({
      candidates: ['/a/git', '/b/git'],
      platform: 'darwin',
      checkExecutable: executableOnly('/b/git'),
      run: runner().run
    })
    expect(result).toEqual({ ok: true, value: '/b/git' })
  })

  it('asks xcrun only after xcode-select succeeds', async () => {
    const { ran, run } = runner({ tools: { developerDir: '/clt', git: '/clt/git' } })
    const result = await locateGit({
      candidates: [],
      platform: 'darwin',
      checkExecutable: executableOnly('/clt/git'),
      run
    })
    expect(result).toEqual({ ok: true, value: '/clt/git' })
    expect(ran).toEqual(['/usr/bin/xcode-select', '/usr/bin/xcrun', '/clt/git'])
  })

  it('never runs xcrun when the Command Line Tools are missing', async () => {
    const { ran, run } = runner()
    const result = await locateGit({
      candidates: [],
      platform: 'darwin',
      checkExecutable: allExecutable,
      run
    })
    expect(result).toEqual({ ok: false, error: 'git-not-found' })
    expect(ran).toEqual(['/usr/bin/xcode-select'])
  })

  it('rejects the /usr/bin/git shim even when xcrun reports it', async () => {
    const result = await locateGit({
      candidates: [],
      platform: 'darwin',
      checkExecutable: allExecutable,
      run: runner({ tools: { developerDir: '/clt', git: '/usr/bin/git' } }).run
    })
    expect(result).toEqual({ ok: false, error: 'git-not-found' })
  })

  it('rejects a relative path from xcrun', async () => {
    const result = await locateGit({
      candidates: [],
      platform: 'darwin',
      checkExecutable: allExecutable,
      run: runner({ tools: { developerDir: '/clt', git: 'git' } }).run
    })
    expect(result).toEqual({ ok: false, error: 'git-not-found' })
  })

  it('rejects an xcrun path that is not executable', async () => {
    const result = await locateGit({
      candidates: [],
      platform: 'darwin',
      checkExecutable: executableOnly(),
      run: runner({ tools: { developerDir: '/clt', git: '/clt/git' } }).run
    })
    expect(result).toEqual({ ok: false, error: 'git-not-found' })
  })

  it('probes /usr/bin/git on Linux and never runs xcrun', async () => {
    const { ran, run } = runner()
    const result = await locateGit({
      candidates: [],
      platform: 'linux',
      checkExecutable: executableOnly('/usr/bin/git'),
      run
    })
    expect(result).toEqual({ ok: true, value: '/usr/bin/git' })
    expect(ran).toEqual(['/usr/bin/git'])
  })

  it('does not probe /usr/bin/git on macOS', async () => {
    const result = await locateGit({
      candidates: [],
      platform: 'darwin',
      checkExecutable: executableOnly('/usr/bin/git'),
      run: runner().run
    })
    expect(result).toEqual({ ok: false, error: 'git-not-found' })
  })

  it.each(['git version 2.39.5 (Apple Git-154)\n', 'git version 2.34.1\n', 'git version 1.9.0\n'])(
    'returns git-too-old for %j',
    async (output) => {
      const result = await locateGit({
        candidates: ['/a/git'],
        platform: 'darwin',
        checkExecutable: allExecutable,
        run: runner({ versions: { '/a/git': output } }).run
      })
      expect(result).toEqual({ ok: false, error: 'git-too-old' })
    }
  )

  it.each(['git version 2.44.0\n', 'git version 2.54.0 (Apple Git-157)\n', 'git version 3.0.1\n'])(
    'accepts %j',
    async (output) => {
      const result = await locateGit({
        candidates: ['/a/git'],
        platform: 'darwin',
        checkExecutable: allExecutable,
        run: runner({ versions: { '/a/git': output } }).run
      })
      expect(result).toEqual({ ok: true, value: '/a/git' })
    }
  )

  it('falls through an old git to a newer one', async () => {
    const result = await locateGit({
      candidates: ['/old/git', '/new/git'],
      platform: 'darwin',
      checkExecutable: allExecutable,
      run: runner({ versions: { '/old/git': 'git version 2.30.0\n' } }).run
    })
    expect(result).toEqual({ ok: true, value: '/new/git' })
  })

  it('treats unreadable version output as not found', async () => {
    const result = await locateGit({
      candidates: ['/a/git'],
      platform: 'darwin',
      checkExecutable: allExecutable,
      run: runner({ versions: { '/a/git': 'something else\n' } }).run
    })
    expect(result).toEqual({ ok: false, error: 'git-not-found' })
  })
})
