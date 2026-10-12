import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'

/**
 * Copies a session ref onto its transfer shape, keeping only the folder name
 * and the session id.
 *
 * @param ref - Anything that names a session by folder and id.
 * @returns The ref as sent to the renderer.
 */
export function mapSessionRef(ref: SessionRefDto): SessionRefDto {
  return { projectDirName: ref.projectDirName, sessionId: ref.sessionId }
}
