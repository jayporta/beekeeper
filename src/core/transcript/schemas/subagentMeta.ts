import { z } from 'zod'
import { isBranchNameWithinCap, MAX_BRANCH_CODE_UNITS } from '../../shared/boundedBranch'
import { isAbsolutePathWithinCap, MAX_PATH_CODE_UNITS } from '../../shared/boundedPath'
import { toAgentLabel } from '../agentLabel'

/** A string cleaned by {@link toAgentLabel}, failing the parse when it is unusable. */
const requiredAgentLabelSchema = z
  .string()
  .transform(toAgentLabel)
  .refine((label): label is string => label !== null, {
    message: 'must be a printable, non-blank label within the label cap'
  })

/** A string cleaned by {@link toAgentLabel}, reading as absent when it is unusable or not a string. */
const optionalAgentLabelSchema = z
  .string()
  .transform((value) => toAgentLabel(value) ?? undefined)
  .optional()
  .catch(undefined)

/**
 * A subagent's `.meta.json` sidecar. `agentType` is the only field every
 * subagent has; any other field, `toolUseId` included, may be absent
 * depending on how the subagent was spawned.
 *
 * `agentType`, `teamName` and `name` are labels: each is trimmed and
 * normalized to NFC, and must be printable and within the label cap, by the
 * same rule a session's role uses (see {@link toAgentLabel}). An unusable
 * `agentType` fails the whole meta, like a non-string one. An unusable or
 * non-string `teamName` or `name` reads as absent, so the subagent is kept.
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
  agentType: requiredAgentLabelSchema,
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
  teamName: optionalAgentLabelSchema,
  name: optionalAgentLabelSchema,
  taskKind: z.string().optional(),
  isFork: z.boolean().optional()
})

/** A validated subagent `.meta.json` sidecar. */
export type SubagentMeta = z.infer<typeof subagentMetaSchema>
