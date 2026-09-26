import { z } from 'zod'

/** The longest `agent_id`, `name`, `team_name` or `agent_type` this schema accepts; real values run under ~50. */
const MAX_SPAWN_FIELD_CHARS = 256

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
  agent_id: z.string().max(MAX_SPAWN_FIELD_CHARS).optional().catch(undefined),
  name: z.string().max(MAX_SPAWN_FIELD_CHARS),
  team_name: z.string().max(MAX_SPAWN_FIELD_CHARS).optional().catch(undefined),
  agent_type: z.string().max(MAX_SPAWN_FIELD_CHARS).optional().catch(undefined)
})

/** A validated teammate spawn result. */
export type TeammateSpawnResult = z.infer<typeof teammateSpawnResultSchema>
