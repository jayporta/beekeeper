import { z } from 'zod'

/** The longest file path this schema accepts; real paths run well under this. */
const MAX_FILE_PATH_CHARS = 4096

/**
 * A tool result's `filePath` field, shared by the `Edit` and `Write`
 * `toolUseResult` schemas.
 */
export const filePathSchema = z.string().max(MAX_FILE_PATH_CHARS)
