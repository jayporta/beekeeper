import type { TranscriptFileInfo } from '../../core/transcript/statTranscriptFile'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import { isDetailDue } from '../archive/isDetailDue'
import { lastActivityMs } from '../archive/lastActivityMs'
import { safeArchiveWrite } from '../archive/safeArchiveWrite'
import type { IpcDeps } from './ipcDeps'

/** Options for {@link archiveSessionDetail}. */
export interface ArchiveSessionDetailOptions {
  /** Where to archive and the clock. */
  readonly deps: Pick<IpcDeps, 'archive' | 'now'>
  /** The project folder of the session. */
  readonly projectDirName: string
  /** The scanned detail. */
  readonly detail: SessionDetailDto
  /** The lead transcript the detail was scanned from. */
  readonly transcript: TranscriptFileInfo
}

/**
 * Archives a scanned detail once its session has been quiet for the waiting
 * period. A more recent session is left to the background archiver, so a
 * session that is still running isn't written on every view. A failing write
 * is logged once per kind and never fails the request.
 *
 * @param options - The archive, the clock, the session's folder, its detail, and its transcript.
 */
export function archiveSessionDetail(options: ArchiveSessionDetailOptions): void {
  const { deps, projectDirName, detail, transcript } = options
  const { archive } = deps
  if (archive === null) return
  const last = lastActivityMs({
    activityLatestMs: detail.lead.activity?.latestMs ?? null,
    modifiedMs: transcript.mtimeMs
  })
  if (!isDetailDue(last, deps.now())) return
  const source = { mtimeMs: transcript.mtimeMs, size: transcript.size }
  const ref = { projectDirName, sessionId: detail.sessionId }
  safeArchiveWrite(() => archive.saveDetail(ref, { detail, source }))
}
