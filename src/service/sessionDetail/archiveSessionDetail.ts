import type { TranscriptFileInfo } from '../../core/transcript/statTranscriptFile'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import { isDetailDue } from '../archive/isDetailDue'
import { lastActivityMs } from '../archive/lastActivityMs'
import type { ServiceDeps } from '../serviceDeps'

/** Options for {@link archiveSessionDetail}. */
export interface ArchiveSessionDetailOptions {
  /** Where to archive and the clock. */
  readonly deps: Pick<ServiceDeps, 'archive' | 'now'>
  /** The project folder of the session. */
  readonly projectDirName: string
  /** The scanned detail. */
  readonly detail: SessionDetailDto
  /** Whether the scan is archivable. One that is not is never archived, so it is read again later. */
  readonly archivable: boolean
  /** The lead transcript the detail was scanned from. */
  readonly transcript: TranscriptFileInfo
}

/**
 * Archives a scanned detail once its session has been quiet for the waiting
 * period. A more recent session is left to the background archiver, so a
 * session that is still running isn't written on every view. A scan that is not
 * archivable is not archived either, since a temporary failure would otherwise
 * become permanent. The archive never throws, so a failing write never fails
 * the request.
 *
 * @param options - The archive, the clock, the session's folder, its detail, whether the scan is archivable, and its transcript.
 */
export function archiveSessionDetail(options: ArchiveSessionDetailOptions): void {
  const { deps, projectDirName, detail, archivable, transcript } = options
  const { archive } = deps
  if (archive === null || !archivable) return
  const last = lastActivityMs({
    activityLatestMs: detail.lead.activity?.latestMs ?? null,
    modifiedMs: transcript.mtimeMs
  })
  if (!isDetailDue(last, deps.now())) return
  const source = { mtimeMs: transcript.mtimeMs, size: transcript.size }
  const ref = { projectDirName, sessionId: detail.sessionId }
  archive.saveDetail(ref, { detail, source })
}
