import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import { safeArchiveRead } from '../archive/safeArchiveRead'
import type { IpcDeps } from './ipcDeps'

/** Options for {@link readArchivedSessionDetail}. */
export interface ReadArchivedSessionDetailOptions {
  /** Where to read from, or `null` to read nothing. */
  readonly archive: IpcDeps['archive']
  /** The session whose transcript is gone. */
  readonly ref: SessionRefDto
}

/**
 * Reads a session's archived detail, marked archived. A failing read is
 * logged once per kind and answers as if nothing were archived, so it never
 * turns a missing session into an error.
 *
 * @param options - The archive and the session.
 * @returns The archived detail, or `null` when there is none.
 */
export function readArchivedSessionDetail(
  options: ReadArchivedSessionDetailOptions
): SessionDetailDto | null {
  const { archive, ref } = options
  if (archive === null) return null
  const detail = safeArchiveRead(() => archive.readDetail(ref), null)
  return detail === null ? null : { ...detail, archived: true }
}
