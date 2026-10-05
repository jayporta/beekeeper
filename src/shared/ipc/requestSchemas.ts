import { z } from 'zod'
import { TOTALS_WINDOWS } from './projectTotalsDto'

/** The longest project folder name a request may carry. */
export const MAX_PROJECT_DIR_NAME_LENGTH = 255

/**
 * The longest agent id a request may carry: a filename is at most 255 bytes,
 * and a subagent's is the id between `agent-` and `.jsonl`.
 */
export const MAX_AGENT_ID_LENGTH = 255 - 'agent-'.length - '.jsonl'.length

/** Text of at most `maxLength` characters that could not be a path: no separators or NUL, and not `.` or `..`. */
function pathFreeName(maxLength: number): z.ZodString {
  return z
    .string()
    .min(1)
    .max(maxLength)
    .refine((name) => !name.includes('/') && !name.includes('\\') && !name.includes('\0'))
    .refine((name) => name !== '.' && name !== '..')
}

/**
 * A project folder name as `listProjects` returned it. It is only ever
 * compared with a fresh directory listing, never used to build a path, so
 * this rejects anything that could be a path: separators, NUL, `.` and `..`.
 */
export const projectDirNameSchema = pathFreeName(MAX_PROJECT_DIR_NAME_LENGTH)

/**
 * A subagent id as the session detail returned it: the text between `agent-`
 * and `.jsonl` in its transcript's filename, which is not always hex. It is
 * only ever compared with the ids in a fresh scan of the session, never used
 * to build a path, so this rejects anything that could be a path.
 */
export const agentIdSchema = pathFreeName(MAX_AGENT_ID_LENGTH)

/** A session id: a lowercase UUID, the same shape discovery accepts. */
export const sessionIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

/** The payload of a `listSessions` call. */
export const listSessionsRequestSchema = z.strictObject({ projectDirName: projectDirNameSchema })

/** The payload of a `getSession` call. */
export const getSessionRequestSchema = z.strictObject({
  projectDirName: projectDirNameSchema,
  sessionId: sessionIdSchema
})

/** The payload of a `getProjectTotals` call. */
export const getProjectTotalsRequestSchema = z.strictObject({
  projectDirName: projectDirNameSchema,
  window: z.enum(TOTALS_WINDOWS)
})

/** The payload of a `getWorktreePatch` call. */
export const getWorktreePatchRequestSchema = z.strictObject({
  projectDirName: projectDirNameSchema,
  sessionId: sessionIdSchema,
  agentId: agentIdSchema
})

/** A validated `listSessions` payload. */
export type ListSessionsRequest = z.infer<typeof listSessionsRequestSchema>

/** A validated `getSession` payload. */
export type GetSessionRequest = z.infer<typeof getSessionRequestSchema>

/** A validated `getProjectTotals` payload. */
export type GetProjectTotalsRequest = z.infer<typeof getProjectTotalsRequestSchema>

/** A validated `getWorktreePatch` payload. */
export type GetWorktreePatchRequest = z.infer<typeof getWorktreePatchRequestSchema>
