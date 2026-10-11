import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'

/**
 * Builds the map key for a session across project folders. A bare session id
 * is not unique across folders, and NUL cannot appear in either part.
 *
 * @param ref - The session's folder and id.
 * @returns The folder name and id joined by NUL.
 */
export function sessionRefKey(ref: SessionRefDto): string {
  return `${ref.projectDirName}\0${ref.sessionId}`
}
