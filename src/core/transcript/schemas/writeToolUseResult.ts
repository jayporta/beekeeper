import { z } from 'zod'
import { filePathSchema } from './filePath'

/**
 * A `Write` tool call's `toolUseResult`, the top-level, structured result a
 * user record carries alongside its `tool_result` content block. Validates
 * `filePath` and `type`; fields like `content` and `structuredPatch` are
 * tolerated but ignored.
 */
export const writeToolUseResultSchema = z
  .object({
    filePath: filePathSchema,
    type: z.enum(['create', 'update'])
  })
  .loose()

/** A validated `Write` tool call result. */
export type WriteToolUseResult = z.infer<typeof writeToolUseResultSchema>
