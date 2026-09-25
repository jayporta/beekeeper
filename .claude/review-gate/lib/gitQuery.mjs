import { execFileSync } from 'node:child_process'

/**
 * Runs git and returns its output, or null when git exits with status 1
 * (the answer to "is this key set?" is no).
 * @param {string[]} args - The git arguments.
 * @param {string} cwd - The directory to run git in.
 * @returns {string | null} git's stdout, or null on exit status 1.
 * @throws {Error} When git fails for any other reason.
 */
export function gitOrNull(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 1) return null
    throw error
  }
}
