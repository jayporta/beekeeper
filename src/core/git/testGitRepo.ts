import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeAll, type TestContext } from 'vitest'
import { parseCommitSha, type CommitSha } from './commitSha'
import type { GitBinary } from './gitBinary'
import { locateGit } from './locateGit'

/** Options for {@link TestRepo.write}. */
export interface WriteFileOptions {
  /** Path relative to `dir`. */
  readonly path: string
  /** File content. */
  readonly content: string | Buffer
  /** Base directory, such as a worktree. Defaults to the repo. */
  readonly dir?: string
}

/** A throwaway repository built for one test. */
export interface TestRepo {
  /** The temp directory that holds the repo and any worktrees. */
  readonly root: string
  /** The repository's working directory. */
  readonly dir: string
  /** Runs a git command in `cwd` (default the repo) and returns trimmed stdout. */
  readonly git: (args: readonly string[], cwd?: string) => string
  /** Resolves a revision to its full commit SHA. */
  readonly sha: (revision: string) => CommitSha
  /** Writes a file, creating parent folders. */
  readonly write: (options: WriteFileOptions) => Promise<void>
  /** Removes everything. */
  readonly cleanup: () => Promise<void>
}

/**
 * Finds the host's git for integration tests.
 * @returns The git binary, or `undefined` when the host has none, so a suite can skip.
 */
export async function findTestGit(): Promise<GitBinary | undefined> {
  const located = await locateGit()
  return located.ok ? located.value : undefined
}

/**
 * Creates a synthetic repo on `main` with a fixed author and no signing.
 * @param git - The git binary to drive.
 * @returns The repo and its helpers.
 */
export async function createTestRepo(git: GitBinary): Promise<TestRepo> {
  const root = await mkdtemp(join(tmpdir(), 'beekeeper-git-'))
  const dir = join(root, 'repo')
  await mkdir(dir)
  const env = {
    PATH: '/usr/bin:/bin',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com'
  }
  const run = (args: readonly string[], cwd: string = dir): string =>
    execFileSync(git, ['-c', 'commit.gpgsign=false', ...args], {
      cwd,
      env,
      encoding: 'utf-8'
    }).trim()
  run(['init', '--quiet', '--initial-branch=main'])
  return {
    root,
    dir,
    git: run,
    sha: (revision) => {
      const sha = parseCommitSha(run(['rev-parse', '--verify', `${revision}^{commit}`]))
      if (sha === undefined) throw new Error('test-sha-invalid')
      return sha
    },
    write: async (options) => {
      const path = join(options.dir ?? dir, options.path)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, options.content)
    },
    cleanup: () => rm(root, { recursive: true, force: true })
  }
}

/** Per-suite access to the host git and to repos that are removed after each test. */
export interface TestGitContext {
  /**
   * Returns the host git, or skips the current test when there is none.
   * Under `CI` a missing git fails the test instead, so security tests can't pass silently.
   * @param context - The running test's context.
   */
  readonly requireGit: (context: TestContext) => GitBinary
  /** Creates an empty repo on `main` that is removed after the test. */
  readonly newRepo: (git: GitBinary) => Promise<TestRepo>
  /**
   * Creates a repo whose `main` has `keep.txt` and `old-name.txt` committed
   * and an extra `agent` branch at the same commit. Removed after the test.
   */
  readonly baseRepo: (git: GitBinary) => Promise<TestRepo>
}

/**
 * Registers the hooks a git integration suite needs. Call it once at the top
 * of a test file.
 * @returns Helpers that share one located git and clean up their repos.
 */
export function registerTestGit(): TestGitContext {
  let binary: GitBinary | undefined
  const repos: TestRepo[] = []

  beforeAll(async () => {
    binary = await findTestGit()
  })

  afterEach(async () => {
    await Promise.all(repos.splice(0).map((repo) => repo.cleanup()))
  })

  const newRepo = async (git: GitBinary): Promise<TestRepo> => {
    const repo = await createTestRepo(git)
    repos.push(repo)
    return repo
  }

  return {
    requireGit: (context) => {
      if (binary === undefined) {
        if (process.env['CI'] !== undefined) throw new Error('git 2.44 or newer is required in CI')
        return context.skip()
      }
      return binary
    },
    newRepo,
    baseRepo: async (git) => {
      const repo = await newRepo(git)
      await repo.write({ path: 'keep.txt', content: 'one\ntwo\n' })
      await repo.write({ path: 'old-name.txt', content: 'a\nb\nc\nd\ne\nf\n' })
      repo.git(['add', '-A'])
      repo.git(['commit', '--quiet', '-m', 'base'])
      repo.git(['branch', 'agent'])
      return repo
    }
  }
}
