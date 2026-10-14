import { z } from 'zod'

/** A flag that reads as absent when it is not a boolean. */
const flagSchema = z.boolean().optional().catch(undefined)

/** One hunk of a `structuredPatch`. */
export const hunkSchema = z.object({
  oldStart: z.number().int().nonnegative(),
  oldLines: z.number().int().nonnegative(),
  newStart: z.number().int().nonnegative(),
  newLines: z.number().int().nonnegative(),
  lines: z.array(z.string())
})

/** The patch-bearing parts of an `Edit` result or a `Write` update result. */
export const patchResultSchema = z.object({
  structuredPatch: z.array(hunkSchema),
  userModified: flagSchema
})

/** The parts of a `Write` create result that hold the new file. */
export const createResultSchema = z.object({
  type: z.literal('create'),
  content: z.string(),
  userModified: flagSchema
})

/** A `bashEditDiff.files` entry that names its file and carries hunks. */
export const bashHunkEntrySchema = z.object({
  filePath: z.string(),
  hunks: z.array(hunkSchema)
})
