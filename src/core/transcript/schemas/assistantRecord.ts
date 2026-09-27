import { z } from 'zod'
import { boundedIdentifierSchema } from './boundedIdentifier'
import { usageSchema } from './usage'

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
    message: z
      .object({
        id: boundedIdentifierSchema,
        model: boundedIdentifierSchema,
        usage: usageSchema
      })
      .loose()
  })
  .loose()

/** A validated `assistant` transcript record. */
export type AssistantRecord = z.infer<typeof assistantRecordSchema>
