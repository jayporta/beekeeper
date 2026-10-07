import { join, resolve } from 'node:path'
import { compareCodeUnits } from '../shared/compareCodeUnits'
import { toAgentId, type AgentId } from './ids'
import { isRealDirectory } from './isRealDirectory'
import { readDirentsOrEmpty } from './readDirentsOrEmpty'
import { statTranscriptFile, type TranscriptFileInfo } from './statTranscriptFile'
import { parseWorkflowRunId, type WorkflowRunId } from './workflowRunId'

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
  /**
   * The workflow run whose folder holds the transcript, or `null` for an
   * agent directly in `subagents/`.
   */
  readonly workflowRunId: WorkflowRunId | null
}

/**
 * Lists the subagent transcripts under one session's `subagents/` folder,
 * including those inside workflow run folders.
 *
 * A transcript is a regular file named `agent-<id>.jsonl` with a non-empty
 * id; `agent-.jsonl` is ignored. Its meta file, `agent-<id>.meta.json`, is
 * paired by exact stem when present as a regular file; a meta file with no
 * matching transcript is ignored, as are unrelated siblings such as
 * `agent-<id>.forked-skill.json` or `agent-<id>.marker.json`. A symlinked
 * transcript or meta file is skipped, since `fs.Dirent` never follows
 * symlinks.
 *
 * Agents spawned by a workflow live one level down, in
 * `subagents/workflows/<runId>/`. Only a real folder (not a symlink or a
 * file) under a real `workflows` folder is entered, and only when its name
 * is a valid {@link WorkflowRunId}. Run folders are read in run id order,
 * their agents carry that run id, and a run's `journal.jsonl` and any
 * folder nested inside it are ignored. When an agent id appears more than
 * once, the entry directly in `subagents/` wins, then the earliest run by
 * id, so an id is never listed twice.
 *
 * @param sessionDir - The session's directory, which may contain `subagents/`.
 * A relative path is resolved against the working directory.
 * @returns Subagent entries sorted by agent id, or `[]` when `sessionDir`
 * itself is not a real directory (a file or a symlink), or it has no
 * `subagents` folder, or `subagents` is not a real directory.
 * @throws {Error} When `sessionDir` cannot be stat'd, or `subagents/`,
 * `subagents/workflows/` or a run folder cannot be stat'd or read, for a
 * reason other than being missing. A run folder that can't be read fails
 * the whole listing, as an unreadable `subagents/` does. Callers that must
 * isolate this failure to one session, rather than letting it fail a whole
 * project scan, should catch it and capture it as a `Result` (see
 * `captureSystemError`).
 */
export async function discoverSubagents(sessionDir: string): Promise<SubagentEntry[]> {
  const sessionPath = resolve(sessionDir)
  if (!(await isRealDirectory(sessionPath))) return []

  const subagentsDir = join(sessionPath, 'subagents')
  if (!(await isRealDirectory(subagentsDir))) return []

  const candidates = await listAgentFiles(subagentsDir, null)
  for (const { runId, dir } of await listWorkflowRunDirs(join(subagentsDir, 'workflows'))) {
    candidates.push(...(await listAgentFiles(dir, runId)))
  }

  const seen = new Set<AgentId>()
  const entries = candidates.filter((entry) => {
    if (seen.has(entry.agentId)) return false
    seen.add(entry.agentId)
    return true
  })

  entries.sort((a, b) => compareCodeUnits(a.agentId, b.agentId))
  return entries
}

/** A workflow run's folder under `subagents/workflows/`. */
interface WorkflowRunDir {
  readonly runId: WorkflowRunId
  readonly dir: string
}

/**
 * Lists the run folders under a `workflows` folder.
 * @param workflowsDir - The `subagents/workflows` path.
 * @returns The real folders whose names are valid run ids, in run id order,
 * or `[]` when `workflowsDir` is not a real directory.
 * @throws {Error} When `workflowsDir` cannot be stat'd or read for a reason
 * other than being missing.
 */
async function listWorkflowRunDirs(workflowsDir: string): Promise<WorkflowRunDir[]> {
  if (!(await isRealDirectory(workflowsDir))) return []

  const runs: WorkflowRunDir[] = []
  for (const dirent of await readDirentsOrEmpty(workflowsDir)) {
    const runId = dirent.isDirectory() ? parseWorkflowRunId(dirent.name) : null
    if (runId !== null) runs.push({ runId, dir: join(workflowsDir, dirent.name) })
  }
  return runs.sort((a, b) => compareCodeUnits(a.runId, b.runId))
}

/**
 * Lists the subagent transcripts directly inside one folder, without
 * entering subfolders.
 * @param dir - A session's `subagents/` folder or one run's folder.
 * @param workflowRunId - The run the folder belongs to, stamped on every
 * entry, or `null` for `subagents/` itself.
 * @returns The folder's entries in no particular order.
 * @throws {Error} When `dir` cannot be read for a reason other than being
 * missing.
 */
async function listAgentFiles(
  dir: string,
  workflowRunId: WorkflowRunId | null
): Promise<SubagentEntry[]> {
  const dirents = await readDirentsOrEmpty(dir)
  const fileNames = new Set<string>(dirents.filter((dirent) => dirent.isFile()).map((d) => d.name))

  const entries: SubagentEntry[] = []
  for (const name of fileNames) {
    const id = parseSubagentTranscriptId(name)
    if (id === null) continue

    const transcript = await statTranscriptFile(join(dir, name))
    if (transcript === null) continue

    const metaName = `${SUBAGENT_TRANSCRIPT_PREFIX}${id}.meta.json`
    const metaPath = fileNames.has(metaName) ? join(dir, metaName) : null

    entries.push({ agentId: toAgentId(id), transcript, metaPath, workflowRunId })
  }
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
