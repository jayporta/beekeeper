import { z } from 'zod'
import { isBranchNameWithinCap, MAX_BRANCH_CODE_UNITS } from '../../shared/boundedBranch'
import { isAbsolutePathWithinCap, MAX_PATH_CODE_UNITS } from '../../shared/boundedPath'

/**
 * A subagent's `.meta.json` sidecar. `agentType` is the only field every
 * subagent has; any other field, `toolUseId` included, may be absent
 * depending on how the subagent was spawned.
 *
 * The worktree fields are hardened because they later reach git: an invalid
 * `worktreePath` (not absolute, or over {@link MAX_PATH_CODE_UNITS} UTF-16
 * code units) or `worktreeBranch` (empty, or over {@link MAX_BRANCH_CODE_UNITS}
 * UTF-16 code units) reads as absent instead of failing the whole meta, so
 * `agentType` and the agent tree survive.
 *
 * Unknown keys are stripped, unlike the record schemas that keep `.loose()`:
 * this schema's output is retained in the scan cache, while a record's is
 * reduced to scalars right away.
 */
export const subagentMetaSchema = z.object({
  agentType: z.string(),
  description: z.string().optional(),
  model: z.string().optional(),
  toolUseId: z.string().optional(),
  parentAgentId: z.string().optional(),
  spawnDepth: z.number().optional(),
  stoppedByUser: z.boolean().optional(),
  worktreePath: z
    .string()
    .refine(isAbsolutePathWithinCap, {
      message: `must be an absolute path of at most ${MAX_PATH_CODE_UNITS} UTF-16 code units`
    })
    .optional()
    .catch(undefined),
  worktreeBranch: z
    .string()
    .refine(isBranchNameWithinCap, {
      message: `must be a non-empty name of at most ${MAX_BRANCH_CODE_UNITS} UTF-16 code units`
    })
    .optional()
    .catch(undefined),
  teamName: z.string().optional(),
  name: z.string().optional(),
  taskKind: z.string().optional(),
  isFork: z.boolean().optional()
})

/** A validated subagent `.meta.json` sidecar. */
export type SubagentMeta = z.infer<typeof subagentMetaSchema>
