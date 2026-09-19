import { z } from 'zod'

/**
 * A `fork-context-ref` transcript record: a forked subagent's pointer back
 * to the parent session's context at the point it forked. A session's
 * subagent transcript can carry several, not only on its first line.
 */
export const forkContextRefRecordSchema = z
  .object({
    type: z.literal('fork-context-ref'),
    parentSessionId: z.string(),
    parentLastUuid: z.string(),
    contextLength: z.number()
  })
  .loose()

/** A validated `fork-context-ref` transcript record. */
export type ForkContextRefRecord = z.infer<typeof forkContextRefRecordSchema>
