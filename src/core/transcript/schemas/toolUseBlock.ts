import { z } from 'zod'

/** The longest `id` or `name` this schema accepts; real values run well under this. */
const MAX_TOOL_USE_FIELD_CHARS = 256

/**
 * A `tool_use` content block inside an assistant message: one tool
 * invocation. Validates only `id` and `name`, the fields file-touch
 * tracking reads to later match a `tool_result` back to the tool that
 * produced it; `input` and everything else is tolerated but ignored.
 */
export const toolUseBlockSchema = z
  .object({
    type: z.literal('tool_use'),
    id: z.string().max(MAX_TOOL_USE_FIELD_CHARS),
    name: z.string().max(MAX_TOOL_USE_FIELD_CHARS)
  })
  .loose()

/** A validated `tool_use` content block. */
export type ToolUseBlock = z.infer<typeof toolUseBlockSchema>
