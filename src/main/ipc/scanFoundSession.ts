import { scanSession, type SessionScan } from '../../core/session/scanSession'
import type { TranscriptFileInfo } from '../../core/transcript/statTranscriptFile'
import type { FoundSession } from './findProject'
import type { IpcDeps } from './ipcDeps'

/** Options for {@link scanFoundSession}. */
export interface ScanFoundSessionOptions {
  /** The scan scheduler and the scan cache. */
  readonly deps: Pick<IpcDeps, 'scans' | 'scanCache'>
  /** The session from a fresh listing. */
  readonly found: FoundSession
  /** The session's transcript, already checked readable. */
  readonly transcript: TranscriptFileInfo
}

function buildScanKey(options: ScanFoundSessionOptions): string {
  const { found, transcript } = options
  const { subagents } = found.session
  const entries = subagents.ok
    ? subagents.value.map((entry) => [
        entry.agentId,
        entry.transcript.mtimeMs,
        entry.transcript.size,
        entry.metaPath !== null
      ])
    : []
  return JSON.stringify([
    found.project.dirName,
    found.session.sessionId,
    transcript.mtimeMs,
    transcript.size,
    subagents.ok,
    entries
  ])
}

/**
 * Scans a listed session, reusing a cached scan when the transcript and
 * every subagent file are unchanged. Concurrent misses share one scan
 * through the scheduler, which also caps how many run at once.
 *
 * @param options - The dependencies, the listed session, and its transcript.
 * @returns The session's scan.
 */
export async function scanFoundSession(options: ScanFoundSessionOptions): Promise<SessionScan> {
  const { deps, found, transcript } = options
  const { subagents } = found.session
  const key = buildScanKey(options)
  const cached = deps.scanCache.get(key)
  if (cached !== undefined) return cached

  const scan = await deps.scans.run(key, () =>
    scanSession({
      leadPath: transcript.path,
      subagents: subagents.ok ? subagents.value : [],
      subagentsUnreadable: !subagents.ok
    })
  )
  deps.scanCache.set(key, scan, subagents.ok)
  return scan
}
