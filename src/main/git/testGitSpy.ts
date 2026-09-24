import {
  appendFileSync,
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { toGitBinary, type GitBinary } from '../../core/git/gitBinary'

/** Options for {@link GitSpies.create}. */
export interface GitSpyOptions {
  /** When set, a run whose arguments contain this text is killed by a signal, which reads as `spawn-failed`. */
  readonly failOn?: string
}

/** A git executable that records each run in order, beside marks a test adds. */
export interface GitSpy {
  /** The recording executable to hand to code under test. */
  readonly git: GitBinary
  /** Appends a labeled mark to the shared log. */
  readonly mark: (label: string) => void
  /** The log so far: `git <args>` for each run, and every mark, in order. */
  readonly events: () => string[]
}

/** Creates git spies whose files are removed after each test. */
export interface GitSpies {
  /**
   * Wraps a real git so every run is logged.
   * @param real - The git executable to run.
   * @param options - Optional failure injection.
   */
  readonly create: (real: GitBinary, options?: GitSpyOptions) => GitSpy
}

/**
 * Registers the cleanup hook for git spies. Call it once at the top of a test file.
 * @returns The spy factory.
 */
export function registerGitSpies(): GitSpies {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })
  return {
    create: (real, options = {}) => {
      const dir = mkdtempSync(join(tmpdir(), 'beekeeper-git-spy-'))
      dirs.push(dir)
      const log = join(dir, 'log')
      writeFileSync(log, '')
      const script = join(dir, 'git')
      const killRule =
        options.failOn === undefined
          ? ''
          : `case "$*" in *'${options.failOn}'*) kill -9 $$;; esac\n`
      writeFileSync(
        script,
        `#!/bin/sh\necho "git $*" >> '${log}'\n${killRule}exec '${real}' "$@"\n`
      )
      chmodSync(script, 0o755)
      return {
        git: toGitBinary(script),
        mark: (label) => appendFileSync(log, `${label}\n`),
        events: () => readFileSync(log, 'utf-8').split('\n').filter(Boolean)
      }
    }
  }
}
