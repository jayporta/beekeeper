import { createTeammateSpawnObserver } from './teammateSpawnObserver'
import type { TranscriptTeamSpawns } from './teammateSpawn'

/**
 * The observer's own cap on spawns and, separately, stops. Kept here rather
 * than exported from the module. The summary cache's worst-case budget rests
 * on this value, so the cap tests fail if it moves.
 */
export const MAX_TEAMMATE_ENTRIES = 128

/** Feeds `records` to a fresh teammate spawn observer, in order, and returns what it collected. */
export function collect(records: readonly Record<string, unknown>[]): TranscriptTeamSpawns {
  const observer = createTeammateSpawnObserver()
  for (const record of records) observer.observe(record)
  return observer.result()
}
