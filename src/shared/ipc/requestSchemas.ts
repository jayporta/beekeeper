import { z } from 'zod'

/** The longest project folder name a request may carry. */
export const MAX_PROJECT_DIR_NAME_LENGTH = 255

/**
 * A project folder name as `listProjects` returned it. It is only ever
 * compared with a fresh directory listing, never used to build a path, so
 * this rejects anything that could be a path: separators, NUL, `.` and `..`.
 */
export const projectDirNameSchema = z
  .string()
  .min(1)
  .max(MAX_PROJECT_DIR_NAME_LENGTH)
  .refine((name) => !name.includes('/') && !name.includes('\\') && !name.includes('\0'))
  .refine((name) => name !== '.' && name !== '..')

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

/** A validated `listSessions` payload. */
export type ListSessionsRequest = z.infer<typeof listSessionsRequestSchema>

/** A validated `getSession` payload. */
export type GetSessionRequest = z.infer<typeof getSessionRequestSchema>
