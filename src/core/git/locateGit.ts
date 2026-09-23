import { execFile } from 'node:child_process'
import { access, constants } from 'node:fs/promises'
import { promisify } from 'node:util'
import { err, ok, type Result } from '../transcript/result'
import { toGitBinary, type GitBinary } from './gitBinary'
import { isSupportedGitVersion, parseGitVersion } from './gitVersion'

const execFileAsync = promisify(execFile)

const XCODE_SELECT = '/usr/bin/xcode-select'
const XCRUN = '/usr/bin/xcrun'
/** On macOS this is a shim that can open the Command Line Tools install dialog, so it is only probed elsewhere. */
const SHIM_GIT = '/usr/bin/git'
const PROBE_TIMEOUT_MS = 5000
const PROBE_ENV = { PATH: '/usr/bin:/bin' }

/** Absolute paths probed for a git executable, in order. */
export const DEFAULT_GIT_CANDIDATES: readonly string[] = [
  '/opt/homebrew/bin/git',
  '/usr/local/bin/git'
]

/** Options for {@link locateGit}. Every field defaults to the real host. */
export interface LocateGitOptions {
  /** Absolute paths to check for an executable git, in order. */
  readonly candidates?: readonly string[]
  /** The host platform. Defaults to `process.platform`. Only macOS has the `xcrun` route and the `/usr/bin/git` shim. */
  readonly platform?: NodeJS.Platform
  /** Rejects when `path` isn't an executable file. */
  readonly checkExecutable?: (path: string) => Promise<void>
  /** Runs an absolute-path program with arguments, resolving to its stdout and rejecting on a non-zero exit. */
  readonly run?: (file: string, args: readonly string[]) => Promise<string>
}

async function defaultCheckExecutable(path: string): Promise<void> {
  await access(path, constants.X_OK)
}

async function defaultRun(file: string, args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync(file, [...args], {
    timeout: PROBE_TIMEOUT_MS,
    env: PROBE_ENV,
    encoding: 'utf8'
  })
  return stdout
}

async function isExecutable(
  path: string,
  check: (path: string) => Promise<void>
): Promise<boolean> {
  try {
    await check(path)
    return true
  } catch {
    return false
  }
}

async function findViaCommandLineTools(
  run: NonNullable<LocateGitOptions['run']>,
  check: (path: string) => Promise<void>
): Promise<string | undefined> {
  try {
    await run(XCODE_SELECT, ['-p'])
    const found = (await run(XCRUN, ['--find', 'git'])).trim()
    if (!found.startsWith('/') || found === SHIM_GIT) return undefined
    return (await isExecutable(found, check)) ? found : undefined
  } catch {
    return undefined
  }
}

/** Yields executable git paths in probe order, running `xcrun` only if reached. */
async function* executableCandidates(options: {
  readonly candidates: readonly string[]
  readonly isMac: boolean
  readonly check: (path: string) => Promise<void>
  readonly run: NonNullable<LocateGitOptions['run']>
}): AsyncGenerator<string> {
  const { candidates, isMac, check, run } = options
  for (const candidate of isMac ? candidates : [...candidates, SHIM_GIT]) {
    if (await isExecutable(candidate, check)) yield candidate
  }
  if (!isMac) return
  const viaTools = await findViaCommandLineTools(run, check)
  if (viaTools !== undefined) yield viaTools
}

/**
 * Finds a supported git executable without consulting `PATH` and without
 * running the macOS `/usr/bin/git` shim.
 *
 * @remarks
 * Probes the candidate paths. On macOS it then asks `xcrun` for git, but only
 * when `xcode-select -p` confirms the Command Line Tools are installed. On
 * other platforms it also probes `/usr/bin/git`. Each executable is asked for
 * `--version` and skipped when it is older than the minimum, so an old
 * binary early in the list doesn't hide a newer one.
 *
 * @param options - Overrides for the probed paths and process execution.
 * @returns The git executable, `git-too-old` when only unsupported versions were found, or `git-not-found`.
 */
export async function locateGit(
  options: LocateGitOptions = {}
): Promise<Result<GitBinary, 'git-not-found' | 'git-too-old'>> {
  const run = options.run ?? defaultRun
  let sawTooOld = false
  for await (const path of executableCandidates({
    candidates: options.candidates ?? DEFAULT_GIT_CANDIDATES,
    isMac: (options.platform ?? process.platform) === 'darwin',
    check: options.checkExecutable ?? defaultCheckExecutable,
    run
  })) {
    let version
    try {
      version = parseGitVersion(await run(path, ['--version']))
    } catch {
      continue
    }
    if (version === undefined) continue
    if (isSupportedGitVersion(version)) return ok(toGitBinary(path))
    sawTooOld = true
  }
  return err(sawTooOld ? 'git-too-old' : 'git-not-found')
}
