import { installFileSystem } from '../../../core/io/installFileSystem'
import { installProcessPort } from '../../../core/io/installProcessPort'
import { createModFileSystem } from '../../io/modFileSystem'
import { createModProcessPort } from '../../io/modProcessPort'
import { platformOf } from '../../io/platformOf'
import type { ModHost } from '../../modHost'
import { locateProjectsRoot } from './locateProjectsRoot'
import { meetsMinimumVersion } from './meetsMinimumVersion'
import { MINIMUM_CLAUDE_CODE } from './minimumVersion'

/** How starting the mod went. */
export type StartOutcome =
  /** The mod can run, with its file system and process port installed. */
  | {
      readonly kind: 'ready'
      /** The real path of Claude Code's projects folder (or its path when it doesn't exist yet). */
      readonly projectsRoot: string
      /** Whether git is refused because an inherited repository variable could redirect it. */
      readonly gitDisabled: boolean
    }
  /** Claude Code is older than the minimum; `version` is what it reported. */
  | { readonly kind: 'too-old'; readonly version: string }
  /** Something failed while starting; the cause is left to the engine's debug log. */
  | { readonly kind: 'failed' }

/**
 * Checks the engine's version, then installs the file system and process port core reads through.
 *
 * @param host - What the mod may ask of the engine.
 * @param session - The session being started; `cwd` is the directory relative paths resolve against.
 * @returns The outcome. Never rejects: any error becomes `failed`.
 */
export async function startMod(host: ModHost, session: { cwd: string }): Promise<StartOutcome> {
  try {
    const version = await host.version()
    if (!meetsMinimumVersion(version, MINIMUM_CLAUDE_CODE)) {
      return { kind: 'too-old', version: version.version }
    }
    const projectsRoot = await locateProjectsRoot(host)
    if (projectsRoot === undefined) return { kind: 'failed' }
    const platform = await host.osName().then(platformOf, () => platformOf(''))
    const gitDisabled = (await host.gitRepoVariablesSet()).length > 0
    installFileSystem(createModFileSystem({ host, cwd: session.cwd, projectsRoot }))
    installProcessPort(createModProcessPort({ host, platform, gitDisabled }))
    return { kind: 'ready', projectsRoot, gitDisabled }
  } catch {
    return { kind: 'failed' }
  }
}
