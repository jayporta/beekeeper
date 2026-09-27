import { z } from 'zod'
import { boundedIdentifierSchema } from './boundedIdentifier'

/**
 * A `tool_use` content block inside an assistant message: one tool
 * invocation. Validates only `id` and `name`, the fields two readers need to
 * match a `tool_result` back to the tool that produced it: file-touch
 * tracking, and the teammate spawn observer, which matches a `TaskStop` to
 * the result that says whether its target was a teammate. `input` and
 * everything else is tolerated but ignored.
 */
export const toolUseBlockSchema = z
  .object({
    type: z.literal('tool_use'),
    id: boundedIdentifierSchema,
    name: boundedIdentifierSchema
  })
  .loose()

/** A validated `tool_use` content block. */
export type ToolUseBlock = z.infer<typeof toolUseBlockSchema>
