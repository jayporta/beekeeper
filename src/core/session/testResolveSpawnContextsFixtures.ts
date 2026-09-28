import { toAgentId, type AgentId } from '../transcript/ids'
import { resolveAgentHierarchy } from './agentHierarchy'
import type { AgentTreeInput } from './agentTree'
import { resolveSpawnContexts } from './resolveSpawnContexts'
import type { SpawnContext } from './spawnContext'
import type { BranchSighting, ObservedSpawn, TranscriptSpawns } from './spawnObserver'
import { buildTreeInput } from './testAgentTreeFixtures'

/**
 * Synthetic fixtures for `resolveSpawnContexts` tests. Never derived from a
 * real `~/.claude` transcript.
 */

/**
 * Builds an {@link AgentTreeInput} with a `general-purpose` meta, or an absent one.
 *
 * @param id - The subagent's id.
 * @param meta - Meta fields merged onto the default `general-purpose` meta, or
 * `null` for a subagent whose meta is absent.
 * @returns The input, with its meta status set accordingly.
 */
export function agent(id: string, meta: Record<string, unknown> | null): AgentTreeInput {
  return buildTreeInput(id, meta === null ? null : { agentType: 'general-purpose', ...meta })
}

/**
 * Builds a {@link TranscriptSpawns} from a plain map of spawns and an optional timeline.
 *
 * @param spawns - The observed spawns, keyed by tool-use id.
 * @param timeline - The branch sightings, in file order.
 * @returns The transcript's observed spawns, with no start time.
 */
export function transcript(
  spawns: Record<string, ObservedSpawn> = {},
  timeline: BranchSighting[] = []
): TranscriptSpawns {
  return {
    spawns: new Map(Object.entries(spawns)),
    timeline,
    startedAt: undefined,
    firstCwd: undefined
  }
}

/**
 * Copies a transcript with its `startedAt` set.
 * @param base - The transcript to copy.
 * @param at - The start time to set, or `undefined` for none.
 * @returns The copy, with `startedAt` replaced.
 */
export function startedAt(base: TranscriptSpawns, at: number | undefined): TranscriptSpawns {
  return { ...base, startedAt: at }
}

/**
 * The lead transcript shared by every {@link resolve} call: two exact
 * spawns (`t1`, `t2`) and one timeline entry on `main`.
 */
const lead = transcript(
  {
    t1: { cwd: '/repo', baseBranch: 'feat/one' },
    t2: { cwd: '/other', baseBranch: undefined }
  },
  [{ branch: 'main', cwd: '/lead', timestamp: 0 }]
)

/**
 * Resolves spawn contexts for `subagents` against the shared {@link lead}
 * transcript and the given subagent transcripts.
 *
 * @param subagents - The session's subagents.
 * @param others - Each subagent's observed transcript, by id.
 * @returns The resolved spawn context per agent id.
 */
export function resolve(
  subagents: AgentTreeInput[],
  others: Record<string, TranscriptSpawns> = {}
): ReadonlyMap<AgentId, SpawnContext> {
  return resolveSpawnContexts({
    hierarchy: resolveAgentHierarchy(subagents),
    leadTranscript: lead,
    subagentTranscripts: new Map(Object.entries(others).map(([id, t]) => [toAgentId(id), t]))
  })
}
