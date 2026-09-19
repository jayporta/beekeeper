import { z } from 'zod'

/**
 * A record's optional timestamp field. Several record types (`ai-title`,
 * `cost-state`, `mode`, `last-prompt`, `file-history-snapshot`) never carry
 * one, and a value that is present but not a parseable date is treated as
 * absent rather than rejected, since a malformed timestamp is not worth
 * failing a whole record over.
 */
export const timestampSchema = z
  .unknown()
  .optional()
  .transform((value) =>
    typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : undefined
  )
