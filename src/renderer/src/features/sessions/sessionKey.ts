import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'

/**
 * A stable key for a session across project folders, for React keys.
 *
 * @param ref - The session's folder and id.
 * @returns The folder name and id joined by `/`, which neither contains.
 */
export function sessionKey(ref: SessionRefDto): string {
  return `${ref.projectDirName}/${ref.sessionId}`
}
