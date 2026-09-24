import type { GitBinary } from '../../core/git/gitBinary'
import { realpath } from 'node:fs/promises'
import { err, ok, type Result } from '../../core/transcript/result'
import { isInside } from './containment'
import { realCommonDir } from './gitCommonDir'
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

/** What the session's first `cwd` established. */
interface Project {
  /** The repository's real top-level. */
  readonly top: string
  /** The session's first `cwd`, as written. */
  readonly firstCwd: string
  /** The top-level as spelled through the first `cwd`, which may cross symlinks. */
  readonly lexicalTop: string
  /** The repository's real `--git-common-dir`. */
  readonly common: string
}

/**
 * Recovers the top-level's spelling from the first `cwd`, but only when that
 * spelling resolves to the top-level itself (such as `/var/x` for
 * `/private/var/x`). A symlink below the top-level would make it name
 * somewhere else, so the real top-level is used instead.
 */
async function lexicalRoot(options: {
  readonly cwd: string
  readonly top: string
}): Promise<string> {
  const { cwd, top } = options
  try {
    const real = await realpath(cwd)
    if (!isInside(top, real)) return top
    const suffix = real.slice(top.length)
    const lexical = suffix === '' ? cwd : cwd.endsWith(suffix) ? cwd.slice(0, -suffix.length) : top
    return (await realpath(lexical)) === top ? lexical : top
  } catch {
    return top
  }
}

function insideLexically(project: Project, path: string): boolean {
  return (
    isInside(project.top, path) ||
    isInside(project.lexicalTop, path) ||
    isInside(project.firstCwd, path)
  )
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
   * or belongs to a different repository. A failure to ask git, or to
   * establish the project, comes back as an error, since it says nothing
   * about whether the worktree exists.
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
 * by path text before any file or git call touches it, sit inside it again
 * after symlinks resolve, and belong to the same repository (matching
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
  const repos = new Map<string, Promise<Result<string, ConfineRepoError>>>()

  async function establishProject(): Promise<Result<Project, ConfineRepoError>> {
    if (firstCwd === undefined || encodeProjectDir(firstCwd) !== projectDirName) {
      return err('outside-project')
    }
    const top = await verifyRepo({ git, dir: firstCwd })
    if (!top.ok) return top
    const common = await realCommonDir({ git, dir: top.value })
    if (!common.ok) return common
    const lexicalTop = await lexicalRoot({ cwd: firstCwd, top: top.value })
    return ok({ top: top.value, firstCwd, lexicalTop, common: common.value })
  }
  let project: Promise<Result<Project, ConfineRepoError>> | undefined
  const getProject = (): Promise<Result<Project, ConfineRepoError>> =>
    (project ??= establishProject())

  async function confine(spawnCwd: string): Promise<Result<string, ConfineRepoError>> {
    const first = await getProject()
    if (!first.ok) return first
    if (!insideLexically(first.value, spawnCwd)) return err('outside-project')
    let real: string
    try {
      real = await realpath(spawnCwd)
    } catch {
      return err('repo-missing')
    }
    if (!isInside(first.value.top, real)) return err('outside-project')
    const spawn = await verifyRepo({ git, dir: real })
    if (!spawn.ok) return spawn
    const common = await realCommonDir({ git, dir: spawn.value })
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
      if (!insideLexically(first.value, path)) return ok(undefined)
      let real: string
      try {
        real = await realpath(path)
      } catch {
        return ok(undefined)
      }
      if (!isInside(first.value.top, real)) return ok(undefined)
      const common = await realCommonDir({ git, dir: real })
      if (!common.ok) return common.error === 'not-a-repo' ? ok(undefined) : common
      return ok(common.value === first.value.common ? real : undefined)
    }
  }
}
