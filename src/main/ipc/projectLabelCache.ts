import { captureSystemError } from '../../core/transcript/captureSystemError'
import type { ProjectEntry } from '../../core/transcript/discoverProjects'
import { readCwdLabel } from '../../core/transcript/readCwdLabel'
import { describeError } from '../describeError'
import { fingerprintOf, readFolderMtime, stampTranscripts } from './projectLabelFingerprint'
import { readProjectLabel, type ProjectLabelRead } from './readProjectLabel'
import { createScanScheduler } from './scanScheduler'

/** How many projects are labeled at once. */
export const MAX_CONCURRENT_LABELS = 4

/** Labels project folders from the working directory their transcripts record. */
export interface ProjectLabelCache {
  /**
   * Labels each project and drops any project not listed here, so the cache
   * never holds more than the projects last listed. Projects are read a few
   * at a time.
   *
   * A folder's name encodes the working directory Claude Code was started in,
   * so once a project has a label it cannot change, and it is returned with no
   * filesystem access. A project with no label is retried only when its
   * folder's modification time, or the modification time or size of a
   * transcript that was read, changes. That includes a read that failed with a
   * system error, which is logged by its code and the project's position in
   * the list, never by name or path. A project whose folder cannot be stat'd
   * gets `null` and is retried on the next call.
   *
   * @param projects - Every project currently listed.
   * @returns Each project's label by folder name, `null` when it has none.
   * @throws {Error} When reading fails with an error that carries no system
   * error code, which indicates a bug.
   */
  labelsFor(projects: readonly ProjectEntry[]): Promise<ReadonlyMap<string, string | null>>
}

/** Options for {@link createProjectLabelCache}. */
export interface ProjectLabelCacheOptions {
  /** Receives each one-line failure log. Defaults to `console.warn`. */
  readonly log?: (line: string) => void
  /** Reads one transcript's label. Defaults to the first-lines `cwd` read. */
  readonly readLabel?: (transcriptPath: string) => Promise<string | null>
}

/**
 * Creates an empty project label cache.
 *
 * @param options - Where to log failures and how to read a transcript, for tests.
 * @returns The cache.
 */
export function createProjectLabelCache(options: ProjectLabelCacheOptions = {}): ProjectLabelCache {
  const { log = console.warn, readLabel = readCwdLabel } = options
  const scheduler = createScanScheduler({ maxConcurrent: MAX_CONCURRENT_LABELS })
  let cached = new Map<string, ProjectLabelRead>()

  /** Whether a label-less entry still describes its folder and the transcripts it read. */
  async function isCurrent(project: ProjectEntry, entry: ProjectLabelRead): Promise<boolean> {
    const now = await captureSystemError(async () =>
      fingerprintOf(
        await readFolderMtime(project.path),
        await stampTranscripts(project.path, entry.names)
      )
    )
    return now.ok && now.value === entry.fingerprint
  }

  async function labelFor(
    project: ProjectEntry,
    position: string
  ): Promise<ProjectLabelRead | null> {
    const hit = cached.get(project.dirName)
    if (hit !== undefined && (hit.label !== null || (await isCurrent(project, hit)))) return hit

    const logFailure = (error: { readonly code: string }): void => {
      log(`Beekeeper could not read the label of project ${position} (${describeError(error)}).`)
    }
    const read = await captureSystemError(() =>
      readProjectLabel(project, { readLabel, onFailure: logFailure })
    )
    if (read.ok) return read.value
    logFailure(read.error)
    return null
  }

  return {
    async labelsFor(projects) {
      const results = await Promise.all(
        projects.map((project, index) =>
          scheduler.run(project.dirName, () =>
            labelFor(project, `${index + 1} of ${projects.length}`)
          )
        )
      )
      const labels = new Map<string, string | null>()
      const next = new Map<string, ProjectLabelRead>()
      projects.forEach((project, index) => {
        const result = results[index] ?? null
        labels.set(project.dirName, result?.label ?? null)
        if (result !== null) next.set(project.dirName, result)
      })
      cached = next
      return labels
    }
  }
}
