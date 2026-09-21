import { z } from 'zod'
import { filePathSchema } from './filePath'

/**
 * An `Edit` tool call's `toolUseResult`, the top-level, structured result a
 * user record carries alongside its `tool_result` content block. Validates
 * only `filePath`; fields like `oldString`, `newString`, and
 * `structuredPatch` are tolerated but ignored.
 */
export const editToolUseResultSchema = z
  .object({
    filePath: filePathSchema
  })
  .loose()

/** A validated `Edit` tool call result. */
export type EditToolUseResult = z.infer<typeof editToolUseResultSchema>
