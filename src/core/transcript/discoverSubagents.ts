import { join, resolve } from 'node:path'
import { compareCodeUnits } from './compareCodeUnits'
import { toAgentId, type AgentId } from './ids'
import { isRealDirectory } from './isRealDirectory'
import { readDirentsOrEmpty } from './readDirentsOrEmpty'
import { statTranscriptFile, type TranscriptFileInfo } from './statTranscriptFile'

/** Filename affixes bracketing a subagent id in its transcript's filename. */
const SUBAGENT_TRANSCRIPT_PREFIX = 'agent-'
const SUBAGENT_TRANSCRIPT_SUFFIX = '.jsonl'

/** One subagent transcript found under a session's `subagents/` folder. */
export interface SubagentEntry {
  /** The subagent's id, parsed from its transcript's filename. */
  readonly agentId: AgentId
  /** The subagent's transcript file. */
  readonly transcript: TranscriptFileInfo
  /** The subagent's paired `.meta.json` file, or `null` when it has none. */
  readonly metaPath: string | null
}

/**
 * Lists the subagent transcripts under one session's `subagents/` folder.
 *
 * A transcript is a regular file named `agent-<id>.jsonl` with a non-empty
 * id; `agent-.jsonl` is ignored. Its meta file, `agent-<id>.meta.json`, is
 * paired by exact stem when present as a regular file; a meta file with no
 * matching transcript is ignored, as are unrelated siblings such as
 * `agent-<id>.forked-skill.json` or `agent-<id>.marker.json`. A symlinked
 * transcript or meta file is skipped, since `fs.Dirent` never follows
 * symlinks.
 *
 * @param sessionDir - The session's directory, which may contain `subagents/`.
 * A relative path is resolved against the working directory.
 * @returns Subagent entries sorted by agent id, or `[]` when `sessionDir`
 * itself is not a real directory (a file or a symlink), or it has no
 * `subagents` folder, or `subagents` is not a real directory.
 * @throws {Error} When `sessionDir` cannot be stat'd, or `subagents/`
 * cannot be stat'd or read, for a reason other than being missing. Callers
 * that must isolate this failure to one session, rather than letting it
 * fail a whole project scan, should catch it and capture it as a
 * `Result` (see `captureSystemError`).
 */
export async function discoverSubagents(sessionDir: string): Promise<SubagentEntry[]> {
  const sessionPath = resolve(sessionDir)
  if (!(await isRealDirectory(sessionPath))) return []

  const subagentsDir = join(sessionPath, 'subagents')
  if (!(await isRealDirectory(subagentsDir))) return []

  const dirents = await readDirentsOrEmpty(subagentsDir)
  const fileNames = new Set<string>(dirents.filter((dirent) => dirent.isFile()).map((d) => d.name))

  const entries: SubagentEntry[] = []
  for (const name of fileNames) {
    const id = parseSubagentTranscriptId(name)
    if (id === null) continue

    const transcript = await statTranscriptFile(join(subagentsDir, name))
    if (transcript === null) continue

    const metaName = `${SUBAGENT_TRANSCRIPT_PREFIX}${id}.meta.json`
    const metaPath = fileNames.has(metaName) ? join(subagentsDir, metaName) : null

    entries.push({ agentId: toAgentId(id), transcript, metaPath })
  }

  entries.sort((a, b) => compareCodeUnits(a.agentId, b.agentId))
  return entries
}

/**
 * Parses a subagent id out of a candidate transcript filename.
 * @param name - A filename to test against `agent-<id>.jsonl`.
 * @returns The id, or `null` when `name` doesn't match or the id is empty.
 */
function parseSubagentTranscriptId(name: string): string | null {
  if (!name.startsWith(SUBAGENT_TRANSCRIPT_PREFIX) || !name.endsWith(SUBAGENT_TRANSCRIPT_SUFFIX)) {
    return null
  }
  const id = name.slice(SUBAGENT_TRANSCRIPT_PREFIX.length, -SUBAGENT_TRANSCRIPT_SUFFIX.length)
  return id.length > 0 ? id : null
}
