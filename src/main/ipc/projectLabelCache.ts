import { lstat } from 'node:fs/promises'
import { captureSystemError } from '../../core/transcript/captureSystemError'
import type { ProjectEntry } from '../../core/transcript/discoverProjects'
import { findNewestTranscript } from '../../core/transcript/findNewestTranscript'
import { readCwdLabel } from '../../core/transcript/readCwdLabel'

/** Labels project folders from the working directory their newest transcript records. */
export interface ProjectLabelCache {
  /**
   * Labels each project and drops any project not listed here, so the cache
   * never holds more than the projects last listed.
   *
   * A folder's name encodes the working directory Claude Code was started in,
   * so once a project has a label it cannot change, and it is returned with
   * no filesystem access. A project with no label yet is retried only when its
   * folder's modification time changes, which adding or removing a transcript
   * does. A project whose folder or transcript is unreadable gets `null` and
   * is retried on the next call.
   *
   * @param projects - Every project currently listed.
   * @returns Each project's label by folder name, `null` when it has none.
   * @throws {Error} When reading fails with an error that carries no system
   * error code, which indicates a bug.
   */
  labelsFor(projects: readonly ProjectEntry[]): Promise<ReadonlyMap<string, string | null>>
}

interface CachedLabel {
  readonly label: string | null
  /** The project folder's modification time when the label was read. Decides a `null` label's retry. */
  readonly dirMtimeMs: number
}

/**
 * Creates an empty project label cache.
 *
 * @returns The cache.
 */
export function createProjectLabelCache(): ProjectLabelCache {
  let cached = new Map<string, CachedLabel>()

  async function labelFor(project: ProjectEntry): Promise<CachedLabel | null> {
    const read = await captureSystemError(async (): Promise<CachedLabel> => {
      const hit = cached.get(project.dirName)
      if (hit !== undefined && hit.label !== null) return hit
      // Read before listing, so a transcript added mid-read changes the folder's time again.
      const { mtimeMs } = await lstat(project.path)
      if (hit?.dirMtimeMs === mtimeMs) return hit
      const newest = await findNewestTranscript(project.path)
      const label = newest === null ? null : await readCwdLabel(newest.path)
      return { label, dirMtimeMs: mtimeMs }
    })
    return read.ok ? read.value : null
  }

  return {
    async labelsFor(projects) {
      const labels = new Map<string, string | null>()
      const next = new Map<string, CachedLabel>()
      for (const project of projects) {
        const result = await labelFor(project)
        labels.set(project.dirName, result?.label ?? null)
        if (result !== null) next.set(project.dirName, result)
      }
      cached = next
      return labels
    }
  }
}
