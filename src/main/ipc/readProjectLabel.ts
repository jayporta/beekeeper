import { join } from 'node:path'
import { captureSystemError } from '../../core/transcript/captureSystemError'
import type { ProjectEntry } from '../../core/transcript/discoverProjects'
import { findTranscriptCandidates } from '../../core/transcript/findTranscriptCandidates'
import { fingerprintOf, readFolderMtime, stampTranscripts } from './projectLabelFingerprint'

/** What one read of a project's label found, and the state it was read under. */
export interface ProjectLabelRead {
  /** The label, or `null` when no candidate transcript gave one. */
  readonly label: string | null
  /** The candidate transcript names that were considered, in order. */
  readonly names: readonly string[]
  /** The folder and candidate state the read began under. Changes when a retry could find more. */
  readonly fingerprint: string
}

/** Options for {@link readProjectLabel}. */
export interface ReadProjectLabelOptions {
  /** Reads one transcript's label. Rejects with the file's system error when it cannot be read. */
  readonly readLabel: (transcriptPath: string) => Promise<string | null>
  /** Told the system error of each listing or transcript read that failed, which is then skipped. */
  readonly onFailure: (error: { readonly code: string }) => void
}

/**
 * Reads a project's label from its first few transcripts, in name order,
 * stopping at the first that gives one. Claude Code names the folder by
 * replacing characters such as `/` and `.` in the working directory with `-`,
 * so its transcripts can record different directories, and the first one
 * decides the label.
 *
 * The fingerprint is taken before anything is read, so a transcript written
 * during the read changes it. A listing or read that fails with a system error
 * is reported and counted as no label, and the fingerprint still covers it.
 *
 * @param project - The project to label.
 * @param options - How to read a label and where to report failures.
 * @returns The label and the fingerprint it was read under.
 * @throws {Error} When the folder cannot be stat'd, or any failure carries no system error code.
 */
export async function readProjectLabel(
  project: ProjectEntry,
  options: ReadProjectLabelOptions
): Promise<ProjectLabelRead> {
  const folderMtimeMs = await readFolderMtime(project.path)
  const listing = await captureSystemError(() => findTranscriptCandidates(project.path))
  if (!listing.ok) options.onFailure(listing.error)
  const names = listing.ok ? listing.value : []
  const fingerprint = fingerprintOf(folderMtimeMs, await stampTranscripts(project.path, names))

  for (const name of names) {
    const read = await captureSystemError(() => options.readLabel(join(project.path, name)))
    if (!read.ok) options.onFailure(read.error)
    else if (read.value !== null) return { label: read.value, names, fingerprint }
  }
  return { label: null, names, fingerprint }
}
