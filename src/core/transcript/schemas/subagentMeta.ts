import { z } from 'zod'

/**
 * A subagent's `.meta.json` sidecar. `agentType` is the only field every
 * subagent has; a teammate spawned into a team has no `toolUseId`, and any
 * other field may be absent depending on how the subagent was spawned.
 */
export const subagentMetaSchema = z
  .object({
    agentType: z.string(),
    description: z.string().optional(),
    model: z.string().optional(),
    toolUseId: z.string().optional(),
    parentAgentId: z.string().optional(),
    spawnDepth: z.number().optional(),
    stoppedByUser: z.boolean().optional(),
    worktreePath: z.string().optional(),
    worktreeBranch: z.string().optional(),
    teamName: z.string().optional(),
    name: z.string().optional(),
    taskKind: z.string().optional(),
    isFork: z.boolean().optional()
  })
  .loose()

/** A validated subagent `.meta.json` sidecar. */
export type SubagentMeta = z.infer<typeof subagentMetaSchema>
