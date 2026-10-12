import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import type { ServiceDeps } from '../serviceDeps'

/** Options for {@link readArchivedSessionDetail}. */
export interface ReadArchivedSessionDetailOptions {
  /** Where to read from, or `null` to read nothing. */
  readonly archive: ServiceDeps['archive']
  /** The session whose transcript is gone. */
  readonly ref: SessionRefDto
}

/**
 * Reads a session's archived detail, marked archived. The archive never
 * throws, so a failing read answers as if nothing were archived and never
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
  const detail = archive.readDetail(ref)
  return detail === null ? null : { ...detail, archived: true }
}
