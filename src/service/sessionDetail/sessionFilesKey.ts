import type { SessionEntry } from '../../core/transcript/discoverSessions'
import type { TranscriptFileInfo } from '../../core/transcript/statTranscriptFile'

/** What identifies the input files of one listed session. */
export interface SessionFilesKeyOptions {
  /** The session's project folder name. */
  readonly projectDirName: string
  /** The session from a fresh listing. */
  readonly session: SessionEntry
  /** The session's transcript, already checked readable. */
  readonly transcript: TranscriptFileInfo
}

/**
 * Builds a key that covers every input file's identity for a session: the
 * project and session, the lead transcript's mtime and size, whether the
 * subagents were listed, and each subagent's id, mtime, size, whether it has
 * a meta file, and its workflow run. Meta files are assumed write-once, so
 * the key tracks their presence and not their contents.
 *
 * @param options - The project, the listed session, and its transcript.
 * @returns A key that changes when any of those files changes.
 */
export function sessionFilesKey(options: SessionFilesKeyOptions): string {
  const { projectDirName, session, transcript } = options
  const { subagents } = session
  const entries = subagents.ok
    ? subagents.value.map((entry) => [
        entry.agentId,
        entry.transcript.mtimeMs,
        entry.transcript.size,
        entry.metaPath !== null,
        entry.workflowRunId
      ])
    : []
  return JSON.stringify([
    projectDirName,
    session.sessionId,
    transcript.mtimeMs,
    transcript.size,
    subagents.ok,
    entries
  ])
}
