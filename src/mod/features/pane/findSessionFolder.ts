import { sessionIdSchema } from '../../../shared/ipc/requestSchemas'
import type { ModHost } from '../../modHost'

/** Where to look for a session and which folder to prefer. */
interface FindSessionFolderOptions {
  /** The folder that holds the project folders, absolute. */
  readonly projectsRoot: string
  /** The session's id, from the engine. Validated before it joins a path. */
  readonly sessionId: string
  /** The session's working directory, from the engine. */
  readonly sessionRoot: string
}

/** Where Claude Code names a project folder from: every character outside letters and digits becomes a dash. */
function folderNameOf(root: string): string {
  return root.replace(/[^a-zA-Z0-9]/g, '-')
}

/** A project folder's transcript of the session and when it last changed, or `null` when there is none. */
async function transcriptMtime(host: ModHost, path: string): Promise<number | null> {
  try {
    const stat = await host.stat(path)
    return stat.kind === 'file' ? stat.mtimeMs : null
  } catch {
    return null
  }
}

/**
 * Finds the project folder that holds a session's transcript.
 *
 * @remarks
 * With several matches, the folder named for `sessionRoot` wins, else the
 * newest transcript. A missing projects folder or an unreadable entry means
 * "not found", not an error.
 *
 * @param host - What the mod may ask of the engine.
 * @param options - The projects folder, the session id and the session's working directory.
 * @returns The folder's name, or `null` when the id isn't a session id or no folder holds the transcript.
 */
export async function findSessionFolder(
  host: ModHost,
  options: FindSessionFolderOptions
): Promise<string | null> {
  const { projectsRoot, sessionId, sessionRoot } = options
  if (!sessionIdSchema.safeParse(sessionId).success) return null
  let entries
  try {
    entries = await host.list(projectsRoot)
  } catch {
    return null
  }
  const found = await Promise.all(
    entries
      .filter((entry) => entry.kind === 'dir')
      .map(async ({ name }) => ({
        name,
        mtimeMs: await transcriptMtime(host, `${projectsRoot}/${name}/${sessionId}.jsonl`)
      }))
  )
  const matches = found.flatMap(({ name, mtimeMs }) =>
    mtimeMs === null ? [] : [{ name, mtimeMs }]
  )
  const home = folderNameOf(sessionRoot)
  const preferred = matches.find(({ name }) => name === home)
  if (preferred !== undefined) return preferred.name
  const newest = matches.reduce<{ name: string; mtimeMs: number } | null>(
    (best, match) => (best === null || match.mtimeMs > best.mtimeMs ? match : best),
    null
  )
  return newest?.name ?? null
}
