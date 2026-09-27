import { z } from 'zod'
import { isLabelWithinCap, MAX_LABEL_CODE_UNITS } from '../boundedLabel'

/**
 * A schema for a field bounded to {@link MAX_LABEL_CODE_UNITS} UTF-16 code
 * units, since `agent_id`, `name`, `team_name` and `agent_type` all end up
 * shown or matched as agent labels. Bounding by `.refine` on the label
 * predicate, rather than by `.max()`, keeps the cap in code units: a value
 * under a code-point cap but over this one is a value `toAgentLabel` and
 * `splitTeamSuffix` would refuse anyway.
 */
const spawnLabelField = z.string().refine(isLabelWithinCap, {
  message: `must be at most ${MAX_LABEL_CODE_UNITS} UTF-16 code units`
})

/**
 * The `toolUseResult` a teammate spawn writes onto its `user` record.
 * `agent_id` is `name@team` and `team_name` names the team outright; a
 * reader prefers `team_name` and falls back to the `agent_id` suffix. Only
 * `name` is required, since it is the spawn's key: an absent, mistyped or
 * oversized `agent_id`, `team_name` or `agent_type` reads as absent instead
 * of dropping the spawn, so drift in either team source still yields a team.
 * Callers gate on `status` before parsing, since `async_launched` and
 * `completed` results are not teammates.
 *
 * Unlike the repo's other `.loose()` schemas, this one strips unknown
 * fields: the object is unbounded tool output that carries the spawn
 * `prompt` among its keys, and only four are read, so keeping the rest
 * would copy them for nothing. Unknown fields are still accepted.
 */
export const teammateSpawnResultSchema = z.object({
  status: z.literal('teammate_spawned'),
  agent_id: spawnLabelField.optional().catch(undefined),
  name: spawnLabelField,
  team_name: spawnLabelField.optional().catch(undefined),
  agent_type: spawnLabelField.optional().catch(undefined)
})

/** A validated teammate spawn result. */
export type TeammateSpawnResult = z.infer<typeof teammateSpawnResultSchema>
