import type { GitBinary } from '../../core/git/gitBinary'
import { realpath } from 'node:fs/promises'
import { defaultFsRunner, type FsRunner } from '../../core/git/fsDeadline'
import { sep } from 'node:path'
import { resolveInside, type ResolveInsideError } from '../../core/git/resolveInside'
import { err, ok, type Result } from '../../core/shared/result'
import { isInside } from '../../core/git/isInside'
import { realCommonDir } from '../../core/git/gitCommonDir'
import { verifyRepo, type VerifyRepoError } from './verifyRepo'

/** Why a spawn's repository was refused or could not be checked. */
export type ConfineRepoError = VerifyRepoError | 'outside-project'

/** Options for {@link createRepoConfiner}. */
export interface RepoConfinerOptions {
  /** The verified git executable. */
  readonly git: GitBinary
  /** The project folder's name under `~/.claude/projects`. */
  readonly projectDirName: string
  /** The session's first lead `cwd`, or `undefined` when it had none. */
  readonly firstCwd: string | undefined
  /** Runs the filesystem calls under a deadline. Defaults to the app-wide runner. */
  readonly fsRunner?: FsRunner
}

/**
 * Encodes a working directory the way Claude Code names its project folder:
 * every non-alphanumeric character becomes `-`.
 * @param cwd - An absolute working directory.
 * @returns The folder name that directory would get.
 */
export function encodeProjectDir(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-')
}

/** A spelling a project's directory may be reached by, and the real directory it names. */
interface ProjectBase {
  /** The directory as spelled, possibly through symlinks. */
  readonly spelled: string
  /** The real directory the spelling resolves to, inside the top-level. */
  readonly real: string
}

/** What the session's first `cwd` established. */
interface Project {
  /** The repository's real top-level. */
  readonly top: string
  /** The spellings a path may start with to count as inside the project, real top-level first. */
  readonly bases: readonly ProjectBase[]
  /** The repository's real `--git-common-dir`. */
  readonly common: string
}

/** What the first `cwd` resolves to, for the spellings a project accepts. */
interface FirstCwdResolution {
  /** The first `cwd`'s real path, or `undefined` when it can't be resolved or leaves the top-level. */
  readonly real: string | undefined
  /** The top-level's spelling recovered from the first `cwd`, or the real top-level. */
  readonly lexicalTop: string
}

/**
 * Resolves the first `cwd` once, and recovers the top-level's spelling from
 * it, but only when that spelling resolves to the top-level itself (such as
 * `/var/x` for `/private/var/x`). A symlink below the top-level would make it
 * name somewhere else, so the real top-level is used instead. It fails
 * closed: a `cwd` that can't be resolved, including one that hangs past its
 * deadline, adds no spelling.
 */
async function resolveFirstCwd(options: {
  readonly cwd: string
  readonly top: string
  readonly run: FsRunner
}): Promise<FirstCwdResolution> {
  const { cwd, top, run } = options
  try {
    const real = await run(() => realpath(cwd))
    if (!isInside(top, real)) return { real: undefined, lexicalTop: top }
    const suffix = real.slice(top.length)
    const lexical = suffix === '' ? cwd : cwd.endsWith(suffix) ? cwd.slice(0, -suffix.length) : top
    return { real, lexicalTop: (await run(() => realpath(lexical))) === top ? lexical : top }
  } catch {
    return { real: undefined, lexicalTop: top }
  }
}

/** Drops the trailing separators of a spelled directory, except for a bare root. */
function withoutTrailingSeparators(directory: string): string {
  let end = directory.length
  while (end > 1 && directory[end - 1] === sep) end -= 1
  return directory.slice(0, end)
}

/**
 * Re-spells a path that starts with one of the project's spellings under the
 * real top-level, by text alone, so no filesystem call touches the path
 * before it is known to be inside. The walk's root is always the real
 * top-level, so a link under any spelling may lead anywhere else in the
 * repository.
 *
 * @returns The real top-level and the path below it, or `undefined` when the
 * path starts with none of the spellings.
 */
function rebase(project: Project, path: string): { root: string; path: string } | undefined {
  for (const { spelled, real } of project.bases) {
    const base = withoutTrailingSeparators(spelled)
    if (path === base || path.startsWith(base === sep ? base : base + sep)) {
      return { root: project.top, path: real + path.slice(base.length) }
    }
  }
  return undefined
}

/**
 * Maps why a path walk stopped onto the confiner's codes: a path that leaves
 * the project, is over the path cap (`too-long`), holds a `.` or `..`
 * component, or takes too many links or too many steps to resolve
 * (`too-many-links`, `too-many-steps`), is `outside-project`; one that does
 * not resolve (missing, or a file with more path after it: `not-found`,
 * `not-a-directory`) or is unreadable is `repo-missing`; one that hangs past
 * its deadline is `timeout`.
 */
function refusalOf(reason: ResolveInsideError | 'outside-spelling'): ConfineRepoError {
  if (reason === 'timeout') return 'timeout'
  return reason === 'not-found' || reason === 'not-a-directory' || reason === 'unreadable'
    ? 'repo-missing'
    : 'outside-project'
}

/**
 * Resolves a transcript-supplied path that starts with a project spelling,
 * following symlinks only while they stay inside the project.
 * @returns The real path, or the reason the walk stopped.
 */
async function resolveInProject(
  project: Project,
  options: { readonly path: string; readonly fsRunner: FsRunner }
): Promise<Result<string, ResolveInsideError | 'outside-spelling'>> {
  const rebased = rebase(project, options.path)
  return rebased === undefined
    ? err('outside-spelling')
    : resolveInside({ ...rebased, fsRunner: options.fsRunner })
}

/** Vets the directories a transcript names against one session's project. */
export interface RepoConfiner {
  /**
   * Verifies a spawn `cwd` and returns its repository's top-level, or why it was refused.
   * @param spawnCwd - The spawn record's working directory.
   */
  readonly repo: (spawnCwd: string) => Promise<Result<string, ConfineRepoError>>
  /**
   * Resolves a worktree path that lies inside the project's top-level.
   * @param path - The worktree path a subagent's meta names.
   * @returns The real path, or `undefined` when it is missing, lies outside,
   * or belongs to a different repository. A failure to ask git, a filesystem
   * call that hangs past its deadline (`timeout`), or a failure to establish
   * the project comes back as an error, since it says nothing about whether
   * the worktree exists.
   */
  readonly worktree: (path: string) => Promise<Result<string | undefined, ConfineRepoError>>
}

/**
 * Creates the checks that keep transcript-supplied directories inside the
 * session's project.
 *
 * @remarks
 * The session's first `cwd` must encode to the project folder name (a
 * one-way check, so the lossy encoding is never reversed) and resolve to a
 * repository. A spawn `cwd` must then sit inside that repository's top-level
 * by path text before any file or git call touches it, resolve to somewhere
 * inside it by a walk that follows symlinks only while they stay inside (see
 * `resolveInside`), and belong to the same repository (matching
 * `--git-common-dir`, so linked worktrees pass while nested repos fail).
 * A refusal is `outside-project`; a check that could not finish reports its
 * own code. Nothing runs until the first call, and each distinct directory is
 * checked once.
 *
 * @param options - The git binary, the project folder name, and the first `cwd`.
 * @returns The spawn and worktree checks.
 */
export function createRepoConfiner(options: RepoConfinerOptions): RepoConfiner {
  const { git, projectDirName, firstCwd } = options
  const fsRunner = options.fsRunner ?? defaultFsRunner
  const repos = new Map<string, Promise<Result<string, ConfineRepoError>>>()

  async function establishProject(): Promise<Result<Project, ConfineRepoError>> {
    if (firstCwd === undefined || encodeProjectDir(firstCwd) !== projectDirName) {
      return err('outside-project')
    }
    const top = await verifyRepo({ git, dir: firstCwd, fsRunner })
    if (!top.ok) return top
    const common = await realCommonDir({ git, dir: top.value, fsRunner })
    if (!common.ok) return common
    const resolved = await resolveFirstCwd({ cwd: firstCwd, top: top.value, run: fsRunner })
    const bases: ProjectBase[] = [
      { spelled: top.value, real: top.value },
      { spelled: resolved.lexicalTop, real: top.value },
      ...(resolved.real === undefined ? [] : [{ spelled: firstCwd, real: resolved.real }])
    ]
    return ok({ top: top.value, bases, common: common.value })
  }
  let project: Promise<Result<Project, ConfineRepoError>> | undefined
  const getProject = (): Promise<Result<Project, ConfineRepoError>> =>
    (project ??= establishProject())

  async function confine(spawnCwd: string): Promise<Result<string, ConfineRepoError>> {
    const first = await getProject()
    if (!first.ok) return first
    const resolved = await resolveInProject(first.value, { path: spawnCwd, fsRunner })
    if (!resolved.ok) return err(refusalOf(resolved.error))
    const real = resolved.value
    if (!isInside(first.value.top, real)) return err('outside-project')
    const spawn = await verifyRepo({ git, dir: real, fsRunner })
    if (!spawn.ok) return spawn
    const common = await realCommonDir({ git, dir: spawn.value, fsRunner })
    if (!common.ok) return common
    return common.value === first.value.common ? ok(spawn.value) : err('outside-project')
  }

  return {
    repo(spawnCwd) {
      let entry = repos.get(spawnCwd)
      if (entry === undefined) {
        entry = confine(spawnCwd)
        repos.set(spawnCwd, entry)
      }
      return entry
    },
    async worktree(path) {
      const first = await getProject()
      if (!first.ok) return first
      const resolved = await resolveInProject(first.value, { path, fsRunner })
      if (!resolved.ok) return resolved.error === 'timeout' ? err('timeout') : ok(undefined)
      if (!isInside(first.value.top, resolved.value)) return ok(undefined)
      const real = resolved.value
      const common = await realCommonDir({ git, dir: real, fsRunner })
      if (!common.ok) return common.error === 'not-a-repo' ? ok(undefined) : common
      return ok(common.value === first.value.common ? real : undefined)
    }
  }
}
