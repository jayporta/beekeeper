import type { SessionSummary } from './sessionSummary'

/**
 * The weight, in UTF-16 code units, charged for each cached summary beyond
 * its strings: the entry and summary objects, the numbers they hold, and the
 * transcript path the entry is keyed by. A real entry's strings run a few
 * hundred code units, so this sits above them without dwarfing a crafted
 * entry's.
 */
export const SUMMARY_ENTRY_OVERHEAD = 512

function lengthOf(value: string | null): number {
  return value === null ? 0 : value.length
}

/**
 * Weighs a summary for the cache's memory bound: {@link SUMMARY_ENTRY_OVERHEAD}
 * plus the UTF-16 code units of every string it holds, meaning its title, its
 * model, its role's labels, and each label and tool call id in its spawn and
 * stop lists.
 *
 * @param summary - A session summary.
 * @returns The weight in code units.
 */
export function summaryWeight(summary: SessionSummary): number {
  const { role, teamSpawns } = summary
  let weight = SUMMARY_ENTRY_OVERHEAD + lengthOf(summary.title) + lengthOf(summary.model)

  if (role.kind === 'agent') {
    weight += lengthOf(role.agentType) + lengthOf(role.agentName) + lengthOf(role.teamName)
  }
  for (const spawn of teamSpawns.spawns) {
    weight +=
      spawn.agentName.length +
      lengthOf(spawn.teamName) +
      lengthOf(spawn.agentType) +
      lengthOf(spawn.rawToolUseId)
  }
  for (const stop of teamSpawns.stops) {
    weight += stop.agentName.length + lengthOf(stop.teamName)
  }
  return weight
}
