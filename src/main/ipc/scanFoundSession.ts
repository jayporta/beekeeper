import { scanSession, type SessionScan } from '../../core/session/scanSession'
import type { TranscriptFileInfo } from '../../core/transcript/statTranscriptFile'
import type { FoundSession } from '../../service/projects/findProject'
import type { IpcDeps } from './ipcDeps'
import { sessionFilesKey } from './sessionFilesKey'

/** Options for {@link scanFoundSession}. */
export interface ScanFoundSessionOptions {
  /** The scan scheduler, the scan cache and the kept transcript scans. */
  readonly deps: Pick<IpcDeps, 'scans' | 'scanCache' | 'agentScans'>
  /** The session from a fresh listing. */
  readonly found: FoundSession
  /** The session's transcript, already checked readable. */
  readonly transcript: TranscriptFileInfo
}

/**
 * Scans a listed session, reusing a cached scan when the transcript and
 * every subagent file are unchanged. Concurrent misses share one scan
 * through the scheduler, which also caps how many run at once. A miss reads
 * only what recently modified transcripts gained since their kept scans.
 *
 * @param options - The dependencies, the listed session, and its transcript.
 * @returns The session's scan.
 */
export async function scanFoundSession(options: ScanFoundSessionOptions): Promise<SessionScan> {
  const { deps, found, transcript } = options
  const { subagents } = found.session
  const key = sessionFilesKey({
    projectDirName: found.project.dirName,
    session: found.session,
    transcript
  })
  const cached = deps.scanCache.get(key)
  if (cached !== undefined) return cached

  const scan = await deps.scans.run(key, () =>
    scanSession({
      leadPath: transcript.path,
      subagents: subagents.ok ? subagents.value : [],
      subagentsUnreadable: !subagents.ok,
      cache: deps.agentScans
    })
  )
  deps.scanCache.set(key, scan, subagents.ok)
  return scan
}
