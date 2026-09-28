import { foldTeamKey } from './teamKey'
import type { TeammateSpawn } from '../transcript/teammateSpawn'

/**
 * Indexes a lead's spawns by folded (team, name) pair. A spawn that named
 * no team is skipped, and a pair spawned more than once keeps the index of
 * its first spawn.
 *
 * @param spawns - The spawns a lead's transcript recorded, in file order.
 * @returns Each folded pair mapped to its first spawn's index in `spawns`,
 * in the order the pairs were first spawned.
 */
export function spawnPairOrder(spawns: readonly TeammateSpawn[]): Map<string, number> {
  const pairOrder = new Map<string, number>()
  spawns.forEach((spawn, order) => {
    if (spawn.teamName === null) return
    const pairKey = foldTeamKey(spawn.teamName, spawn.agentName)
    if (!pairOrder.has(pairKey)) pairOrder.set(pairKey, order)
  })
  return pairOrder
}
