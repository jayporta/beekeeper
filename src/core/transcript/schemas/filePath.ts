import { z } from 'zod'
import { isPathWithinCap, MAX_PATH_CODE_UNITS } from '../../shared/boundedPath'

/**
 * A tool result's `filePath` field, shared by the `Edit` and `Write`
 * `toolUseResult` schemas. Bounded to {@link MAX_PATH_CODE_UNITS} UTF-16
 * code units, and that cap is the only check: unlike `subagentMeta`'s
 * `worktreePath`, this value never reaches git, so requiring it to be
 * absolute would only drop data.
 */
export const filePathSchema = z.string().refine(isPathWithinCap, {
  message: `must be at most ${MAX_PATH_CODE_UNITS} UTF-16 code units`
})
