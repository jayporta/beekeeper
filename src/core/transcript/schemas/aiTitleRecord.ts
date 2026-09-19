import { z } from 'zod'

/**
 * An `ai-title` transcript record: the generated title for a session. Never
 * carries a `timestamp`.
 */
export const aiTitleRecordSchema = z
  .object({
    type: z.literal('ai-title'),
    title: z.string()
  })
  .loose()

/** A validated `ai-title` transcript record. */
export type AiTitleRecord = z.infer<typeof aiTitleRecordSchema>
