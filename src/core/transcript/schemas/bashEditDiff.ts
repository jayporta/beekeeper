import { z } from 'zod'

/** A boolean flag that reads as absent when it is anything else. */
const flagSchema = z.boolean().optional().catch(undefined)

/**
 * A list that reads as absent when it is not an array. Its entries are left
 * unvalidated and the array is passed through as is, not walked or copied.
 * The reader bounds each list itself, so the array's length is never trusted.
 */
const unboundedListSchema = z.custom<unknown[]>(Array.isArray).optional().catch(undefined)

/**
 * One file entry of a Bash result's `bashEditDiff`. Validates only the path
 * and the `created`/`deleted` flags; the hunks are stripped, never kept.
 */
export const bashEditFileSchema = z.object({
  filePath: z.string(),
  created: flagSchema,
  deleted: flagSchema
})

/**
 * The `bashEditDiff` a Bash call's `toolUseResult` may carry: the files the
 * command changed, as the harness detected them. Validates only what the
 * reader uses, and strips everything else, so hunks (file contents) are never
 * kept.
 *
 * `changedFiles` names every changed path, and `files` holds at most a few
 * entries with hunks, so `files` only refines how a path changed. Both arrays
 * are left as `unknown` entries here, since a crafted result can make them
 * very long: the reader caps and validates them. `unavailable`, `shared`, and
 * `skipped` each mean the harness could not tell what the command changed.
 * `moreFiles` only says the hunks were truncated, and is not read.
 */
export const bashEditDiffSchema = z.object({
  changedFiles: unboundedListSchema,
  files: unboundedListSchema,
  unavailable: flagSchema,
  shared: flagSchema,
  skipped: flagSchema
})

/** A validated Bash `bashEditDiff`. */
export type BashEditDiff = z.infer<typeof bashEditDiffSchema>

/**
 * The shape of a Bash call's `toolUseResult`, of which only `bashEditDiff`
 * is read. It reads as absent when it is missing or is not an object.
 */
export const bashToolUseResultSchema = z.object({
  bashEditDiff: bashEditDiffSchema.optional().catch(undefined)
})
