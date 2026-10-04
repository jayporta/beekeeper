import { NO_AGENT_TERMS, type AgentTerms } from '../../core/session/agentSearchTerms'
import { err } from '../../core/shared/result'
import { discoverSessions, type SessionEntry } from '../../core/transcript/discoverSessions'
import type { ProjectEntry } from '../../core/transcript/discoverProjects'
import type { ProjectDirName } from '../../core/transcript/ids'
import type { SummarizedSession } from '../../core/teams/teamGrouping'
import type { TranscriptFileInfo } from '../../core/transcript/statTranscriptFile'
import { agentTermsKey } from './agentTermsCache'
import type { IpcDeps } from './ipcDeps'
import type { ScannedSession } from './mapSessionListItem'

/**
 * What a scan needs: the summary cache and scheduler, and optionally the agent
 * terms cache. Without it, sessions are scanned with no agent terms and no meta
 * file is read.
 */
export type ScanDeps = Pick<IpcDeps, 'summaryCache' | 'summaries'> &
  Partial<Pick<IpcDeps, 'agentTerms'>>

/**
 * Reads a transcript's summary through the summary cache. The read is shared
 * per transcript state (path, mtime, size) and capped by the summaries
 * scheduler, in its foreground lane.
 *
 * @param file - The transcript's location and stat.
 * @param deps - The summary cache and the summaries scheduler.
 * @returns The summary, or why it could not be read.
 */
export function readSessionSummary(
  file: TranscriptFileInfo,
  deps: ScanDeps
): Promise<ScannedSession['summary']> {
  return deps.summaries.run(summaryKey(file), () => deps.summaryCache.read(file))
}

function summaryKey(file: TranscriptFileInfo): string {
  return `${file.path}\0${file.mtimeMs}\0${file.size}`
}

/**
 * Reads the search terms of a session's subagents through the agent terms
 * cache, under the summaries scheduler. A session with no subagents, or whose
 * subagents couldn't be listed, has none and costs no scheduler turn.
 */
function readAgentTerms(entry: SessionEntry, deps: ScanDeps): Promise<AgentTerms> {
  const { agentTerms } = deps
  if (agentTerms === undefined || !entry.subagents.ok) return Promise.resolve(NO_AGENT_TERMS)
  const subagents = entry.subagents.value
  if (subagents.length === 0) return Promise.resolve(NO_AGENT_TERMS)
  return deps.summaries.run(`terms\0${agentTermsKey(subagents)}`, () => agentTerms.read(subagents))
}

/** How one scan reads each session's summary and subagent search terms. */
interface SessionReaders {
  readonly summary: (file: TranscriptFileInfo) => Promise<ScannedSession['summary']>
  readonly agentTerms: (entry: SessionEntry) => Promise<AgentTerms>
}

async function scanSession(
  located: { readonly projectDirName: ProjectDirName; readonly entry: SessionEntry },
  read: SessionReaders
): Promise<ScannedSession> {
  const { projectDirName, entry } = located
  if (!entry.transcript.ok) {
    return {
      projectDirName,
      entry,
      summary: err(entry.transcript.error),
      agentTerms: NO_AGENT_TERMS
    }
  }

  const summary = await read.summary(entry.transcript.value)
  const agentTerms = await read.agentTerms(entry)
  return { projectDirName, entry, summary, agentTerms }
}

/** What {@link scanProjectSessions} reads. */
export interface ProjectScan {
  /** The folder to scan. */
  readonly project: ProjectEntry
  /**
   * Decides whether a discovered session is read at all. A session it refuses
   * is left out of the result without its summary being read. Called once per
   * session, before any read.
   */
  readonly keep?: (entry: SessionEntry) => boolean
  /**
   * Whether the summary reads wait behind every foreground read, for bulk work
   * no one is waiting on.
   * @defaultValue false
   */
  readonly background?: boolean
}

/**
 * Discovers and summarizes every session of a project folder, or those
 * `keep` accepts. Summary reads are shared per transcript state (path, mtime,
 * size) and capped by the summaries scheduler, and so are the reads of each
 * session's subagent search terms. A background scan reads no search terms.
 *
 * @param scan - The folder, which of its sessions to read, and in which lane.
 * Every session, in the foreground, by default.
 * @param deps - The summary cache and the summaries scheduler, and the agent
 * terms cache when sessions should carry search terms.
 * @returns The kept sessions with the outcome of each summary read.
 */
export async function scanProjectSessions(
  scan: ProjectScan,
  deps: ScanDeps
): Promise<ScannedSession[]> {
  const { project, keep = () => true, background = false } = scan
  const sessions = (await discoverSessions(project.path)).filter(keep)
  const read: SessionReaders = background
    ? {
        summary: (file) =>
          deps.summaries.runInBackground(summaryKey(file), () => deps.summaryCache.read(file)),
        agentTerms: () => Promise.resolve(NO_AGENT_TERMS)
      }
    : {
        summary: (file) => readSessionSummary(file, deps),
        agentTerms: (entry) => readAgentTerms(entry, deps)
      }
  return Promise.all(
    sessions.map((entry) => scanSession({ projectDirName: project.dirName, entry }, read))
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
