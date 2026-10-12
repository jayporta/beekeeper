import { isMissingEntryError } from '../../../core/shared/isMissingEntryError'
import type { ModHost } from '../../modHost'
import { joinPath } from '../../io/posixPath'
import { toPortError } from '../../io/toPortError'

/**
 * Finds Claude Code's projects folder: `projects` under `CLAUDE_CONFIG_DIR`, else under `~/.claude`.
 *
 * @param host - What the mod may ask of the engine.
 * @returns The folder's real path, or the unresolved path when the folder doesn't exist yet. Undefined
 * when neither variable is set or the path would not be absolute.
 * @throws {Error} With a port error's code when the folder can't be examined for a reason other than
 * being absent.
 */
export async function locateProjectsRoot(host: ModHost): Promise<string | undefined> {
  const [configDir, home] = await Promise.all([host.configDir(), host.home()])
  const claudeDir = configDir ? configDir : home ? joinPath(home, '.claude') : undefined
  if (claudeDir === undefined) return undefined
  const root = joinPath(claudeDir, 'projects')
  if (!root.startsWith('/')) return undefined
  try {
    return (await host.stat(root)).realPath ?? root
  } catch (error) {
    const failure = toPortError(error)
    if (isMissingEntryError(failure)) return root
    throw failure
  }
}
