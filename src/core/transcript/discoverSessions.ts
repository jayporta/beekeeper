import { join, resolve } from 'node:path'
import { captureSystemError } from './captureSystemError'
import { compareCodeUnits } from './compareCodeUnits'
import { discoverSubagents, type SubagentEntry } from './discoverSubagents'
import { toSessionId, type SessionId } from './ids'
import { readDirentsOrEmpty } from './readDirentsOrEmpty'
import { ok, type Result } from './result'
import { statTranscriptFile, type TranscriptFileInfo } from './statTranscriptFile'
import type { UnreadableError } from './unreadableError'

/** A session transcript's filename: a lowercase UUID followed by `.jsonl`. */
const SESSION_TRANSCRIPT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/
const SESSION_TRANSCRIPT_SUFFIX = '.jsonl'

/** One session found directly under a project folder. */
export interface SessionEntry {
  /** The session's id, parsed from its transcript's filename. */
  readonly sessionId: SessionId
  /**
   * The session's transcript file, or an error when it couldn't be stat'd.
   * Isolated per session so one unreadable transcript doesn't fail the
   * whole project scan.
   */
  readonly transcript: Result<TranscriptFileInfo, UnreadableError>
  /**
   * The subagents spawned during this session, sorted by agent id, or an
   * error when this one session's `subagents/` folder couldn't be read.
   * Isolated per session so one unreadable folder doesn't fail the whole
   * project scan.
   */
  readonly subagents: Result<readonly SubagentEntry[], UnreadableError>
}

/**
 * Lists the sessions directly under a project folder, each with its
 * transcript and its subagent transcripts.
 *
 * A session transcript is a top-level, regular file whose name is a
 * lowercase UUID followed by `.jsonl`; anything else (a `memory/` folder,
 * `.DS_Store`, an uppercase UUID, a directory or symlink named like a
 * transcript) is ignored. Each transcript's `mtimeMs` and `size` come from
 * `lstat`, read sequentially, one file at a time, never with an unbounded
 * `Promise.all`. Failing to stat one session's transcript, or to read its
 * `subagents/` folder (for example, a directory that lists but whose
 * children can't be stat'd), does not fail the whole scan: that session is
 * still listed, with the failure captured in its `transcript` or
 * `subagents` field instead. A transcript that has simply vanished, or is
 * no longer a regular file, is skipped rather than listed with an error.
 *
 * @param projectPath - The project folder to scan. A relative path is
 * resolved against the working directory.
 * @returns Session entries sorted by session id, or `[]` when `projectPath`
 * does not exist.
 * @throws {Error} When `projectPath` cannot be read, or when statting a
 * session's transcript or reading its subagents throws an error with no
 * system error code, including Node's own `ERR_*` programmer errors.
 */
export async function discoverSessions(projectPath: string): Promise<SessionEntry[]> {
  const projectDir = resolve(projectPath)
  const dirents = await readDirentsOrEmpty(projectDir)

  const entries: SessionEntry[] = []
  for (const dirent of dirents) {
    if (!dirent.isFile() || !SESSION_TRANSCRIPT_PATTERN.test(dirent.name)) continue

    const transcriptResult = await captureSystemError(() =>
      statTranscriptFile(join(projectDir, dirent.name))
    )

    let transcript: Result<TranscriptFileInfo, UnreadableError>
    if (!transcriptResult.ok) {
      transcript = transcriptResult
    } else if (transcriptResult.value === null) {
      continue
    } else {
      transcript = ok(transcriptResult.value)
    }

    const sessionId = dirent.name.slice(0, -SESSION_TRANSCRIPT_SUFFIX.length)
    const subagents = await captureSystemError(() => discoverSubagents(join(projectDir, sessionId)))

    entries.push({ sessionId: toSessionId(sessionId), transcript, subagents })
  }

  entries.sort((a, b) => compareCodeUnits(a.sessionId, b.sessionId))
  return entries
}
