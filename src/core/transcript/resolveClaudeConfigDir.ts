import { join, resolve } from 'node:path'
import { isAbsolutePath } from '../shared/absolutePath'

/**
 * Finds the folder Claude Code keeps its data in: the `CLAUDE_CONFIG_DIR`
 * environment variable when it holds an absolute path, else `.claude` under
 * the home folder. It only builds a path. It never touches the filesystem, so
 * the folder may not exist.
 *
 * @param configDirEnv - The value of `CLAUDE_CONFIG_DIR`, or `undefined` when it is unset. Untrusted: an empty value, a relative one, and one starting with `~` (which no shell expanded) are ignored, never resolved against the working directory, which is `/` for an app started from Finder.
 * @param homeDir - The user's home folder.
 * @returns An absolute path with no trailing slash.
 */
export function resolveClaudeConfigDir(configDirEnv: string | undefined, homeDir: string): string {
  if (configDirEnv !== undefined && isAbsolutePath(configDirEnv)) return resolve(configDirEnv)
  return join(homeDir, '.claude')
}
