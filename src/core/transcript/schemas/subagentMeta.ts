import { z } from 'zod'

/** The longest `worktreePath` accepted; a path this long is not a real one. */
const MAX_WORKTREE_PATH_CHARS = 4096

/** The longest `worktreeBranch` accepted, matching git's ref name limit. */
const MAX_WORKTREE_BRANCH_CHARS = 255

/**
 * A subagent's `.meta.json` sidecar. `agentType` is the only field every
 * subagent has; a teammate spawned into a team has no `toolUseId`, and any
 * other field may be absent depending on how the subagent was spawned.
 *
 * The worktree fields are hardened because they later reach git: an invalid
 * `worktreePath` (not absolute, or too long) or `worktreeBranch` (empty, or
 * too long) reads as absent instead of failing the whole meta, so
 * `agentType` and the agent tree survive.
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
    worktreePath: z
      .string()
      .startsWith('/')
      .max(MAX_WORKTREE_PATH_CHARS)
      .optional()
      .catch(undefined),
    worktreeBranch: z.string().min(1).max(MAX_WORKTREE_BRANCH_CHARS).optional().catch(undefined),
    spawnedWithWorktree: z.boolean().optional().catch(undefined),
    worktreeCleanlyRemoved: z.boolean().optional().catch(undefined),
    teamName: z.string().optional(),
    name: z.string().optional(),
    taskKind: z.string().optional(),
    isFork: z.boolean().optional()
  })
  .loose()

/** A validated subagent `.meta.json` sidecar. */
export type SubagentMeta = z.infer<typeof subagentMetaSchema>
