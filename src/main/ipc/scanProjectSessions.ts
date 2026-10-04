import { err } from '../../core/shared/result'
import { discoverSessions, type SessionEntry } from '../../core/transcript/discoverSessions'
import type { ProjectEntry } from '../../core/transcript/discoverProjects'
import type { ProjectDirName } from '../../core/transcript/ids'
import type { SummarizedSession } from '../../core/teams/teamGrouping'
import type { TranscriptFileInfo } from '../../core/transcript/statTranscriptFile'
import type { IpcDeps } from './ipcDeps'
import type { ScannedSession } from './mapSessionListItem'

type ScanDeps = Pick<IpcDeps, 'summaryCache' | 'summaries'>

/**
 * Reads a transcript's summary through the summary cache. The read is shared
 * per transcript state (path, mtime, size) and capped by the summaries
 * scheduler.
 *
 * @param file - The transcript's location and stat.
 * @param deps - The summary cache and the summaries scheduler.
 * @returns The summary, or why it could not be read.
 */
export function readSessionSummary(
  file: TranscriptFileInfo,
  deps: ScanDeps
): Promise<ScannedSession['summary']> {
  return deps.summaries.run(`${file.path}\0${file.mtimeMs}\0${file.size}`, () =>
    deps.summaryCache.read(file)
  )
}

async function scanSession(
  located: { readonly projectDirName: ProjectDirName; readonly entry: SessionEntry },
  deps: ScanDeps
): Promise<ScannedSession> {
  const { projectDirName, entry } = located
  if (!entry.transcript.ok) return { projectDirName, entry, summary: err(entry.transcript.error) }

  const summary = await readSessionSummary(entry.transcript.value, deps)
  return { projectDirName, entry, summary }
}

/** Options for {@link scanProjectSessions}. */
export interface ScanProjectSessionsOptions {
  /**
   * Decides whether a discovered session is read at all. A session it refuses
   * is left out of the result without its summary being read. Called once per
   * session, before any read.
   */
  readonly keep?: (entry: SessionEntry) => boolean
}

/**
 * Discovers and summarizes every session of a project folder, or those
 * `keep` accepts. Summary reads are shared per transcript state (path, mtime,
 * size) and capped by the summaries scheduler.
 *
 * @param project - The folder to scan.
 * @param deps - The summary cache and the summaries scheduler.
 * @param options - Which sessions to read. Every session by default.
 * @returns The kept sessions with the outcome of each summary read.
 */
export async function scanProjectSessions(
  project: ProjectEntry,
  deps: ScanDeps,
  options: ScanProjectSessionsOptions = {}
): Promise<ScannedSession[]> {
  const { keep = () => true } = options
  const sessions = (await discoverSessions(project.path)).filter(keep)
  return Promise.all(
    sessions.map((entry) => scanSession({ projectDirName: project.dirName, entry }, deps))
  )
}

/**
 * Picks the scanned sessions whose summaries were read, as the team grouping
 * takes them.
 *
 * @param scanned - Scanned sessions from any number of folders.
 * @returns Each readable session with its ref.
 */
export function summarizedSessions(scanned: readonly ScannedSession[]): SummarizedSession[] {
  return scanned.flatMap(({ projectDirName, entry, summary }) =>
    summary.ok
      ? [{ ref: { projectDirName, sessionId: entry.sessionId }, summary: summary.value }]
      : []
  )
}
