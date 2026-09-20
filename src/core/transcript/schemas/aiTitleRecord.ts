import { z } from 'zod'

/**
 * An `ai-title` transcript record: the generated title for a session. The
 * title is carried in `aiTitle`, not `title`. Never carries a `timestamp`,
 * so "latest" means the last such record by line order.
 */
export const aiTitleRecordSchema = z
  .object({
    type: z.literal('ai-title'),
    aiTitle: z.string()
  })
  .loose()

/** A validated `ai-title` transcript record. */
export type AiTitleRecord = z.infer<typeof aiTitleRecordSchema>
