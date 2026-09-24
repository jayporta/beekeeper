import type { GitBinary } from '../../core/git/gitBinary'
import { locateGit } from '../../core/git/locateGit'
import type { Result } from '../../core/transcript/result'

/** The outcome of looking for a usable git executable. */
export type GitLocation = Result<GitBinary, 'git-not-found' | 'git-too-old'>

/**
 * Creates a lazy git lookup. The first call starts the search, concurrent
 * calls share it, and only a found binary is remembered, so installing or
 * upgrading git takes effect without a restart.
 *
 * @param locate - Performs the search. Defaults to {@link locateGit}.
 * @returns A function resolving to the located git or why none was usable.
 */
export function createGitLocator(
  locate: () => Promise<GitLocation> = () => locateGit()
): () => Promise<GitLocation> {
  let found: GitLocation | undefined
  let pending: Promise<GitLocation> | undefined

  return function getGit(): Promise<GitLocation> {
    if (found !== undefined) return Promise.resolve(found)
    pending ??= locate()
      .then((result) => {
        if (result.ok) found = result
        return result
      })
      .finally(() => {
        pending = undefined
      })
    return pending
  }
}
