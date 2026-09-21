import { z } from 'zod'
import { timestampSchema } from './timestamp'
import { usageSchema } from './usage'

/** The longest `message.id` or `message.model` this schema accepts; real values run under ~40 chars. */
const MAX_MESSAGE_FIELD_CHARS = 256

/**
 * An `assistant` transcript record: one API response, possibly one of
 * several records sharing the same `message.id` when the response was
 * split across multiple lines. Validates only the fields the app reads and
 * tolerates unknown ones, since the format drifts between Claude Code
 * versions.
 */
export const assistantRecordSchema = z
  .object({
    type: z.literal('assistant'),
    timestamp: timestampSchema,
    parentUuid: z.string().nullable().optional(),
    isSidechain: z.boolean().optional(),
    message: z
      .object({
        id: z.string().max(MAX_MESSAGE_FIELD_CHARS),
        model: z.string().max(MAX_MESSAGE_FIELD_CHARS),
        usage: usageSchema
      })
      .loose()
  })
  .loose()

/** A validated `assistant` transcript record. */
export type AssistantRecord = z.infer<typeof assistantRecordSchema>
