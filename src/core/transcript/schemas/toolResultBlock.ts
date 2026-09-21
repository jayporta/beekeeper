import { z } from 'zod'

/** The longest `tool_use_id` this schema accepts; real values run well under this. */
const MAX_TOOL_USE_ID_CHARS = 256

/**
 * A `tool_result` content block inside a user message: one tool call's
 * outcome, reported back by id. Validates only `tool_use_id`, the field
 * file-touch tracking reads to match this result back to the `tool_use`
 * block that requested it; `content`, `is_error`, and everything else is
 * tolerated but ignored.
 */
export const toolResultBlockSchema = z
  .object({
    type: z.literal('tool_result'),
    tool_use_id: z.string().max(MAX_TOOL_USE_ID_CHARS)
  })
  .loose()

/** A validated `tool_result` content block. */
export type ToolResultBlock = z.infer<typeof toolResultBlockSchema>
