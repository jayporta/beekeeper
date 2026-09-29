/** Identifies one session by the project folder its transcript lives under and its id. */
export interface SessionRefDto {
  /** The project folder's name exactly as on disk. Never a path. */
  readonly projectDirName: string
  /** The session's id, a lowercase UUID. */
  readonly sessionId: string
}
