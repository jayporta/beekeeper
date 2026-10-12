import type { ModHost } from '../../modHost'
import { meetsMinimumVersion } from './meetsMinimumVersion'
import { MINIMUM_CLAUDE_CODE } from './minimumVersion'

/** How starting the mod went. */
export type StartOutcome =
  /** The mod can run. */
  | { readonly kind: 'ready' }
  /** Claude Code is older than the minimum; `version` is what it reported. */
  | { readonly kind: 'too-old'; readonly version: string }
  /** Something failed while starting; the cause is left to the engine's debug log. */
  | { readonly kind: 'failed' }

/**
 * Checks the engine's version and reports whether the mod can run.
 *
 * @param host - What the mod may ask of the engine.
 * @returns The outcome. Never rejects: any error becomes `failed`.
 */
export async function startMod(host: ModHost): Promise<StartOutcome> {
  try {
    const version = await host.version()
    return meetsMinimumVersion(version, MINIMUM_CLAUDE_CODE)
      ? { kind: 'ready' }
      : { kind: 'too-old', version: version.version }
  } catch {
    return { kind: 'failed' }
  }
}
