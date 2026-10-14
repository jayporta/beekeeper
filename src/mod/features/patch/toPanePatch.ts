import type { WorktreePatchDto, WorktreePatchFileDto } from '../../../shared/ipc/worktreePatchDto'
import { replaceUnprintable } from '../../../core/transcript/replaceUnprintable'
import { cleanPatchText } from './cleanPatchText'
import { cutPatches } from './cutPatches'
import { dropLastHunk } from './hunks'
import { emptyPanePatch, PATCH_CHAR_BUDGET, type PanePatch, type PanePatchFile } from './panePatch'

/** A service file as the pane keeps it: cleaned, and trimmed back to whole hunks when the service cut it. */
function toFile(file: WorktreePatchFileDto): PanePatchFile {
  const cleaned = cleanPatchText(file.patch)
  return {
    path: replaceUnprintable(file.path),
    oldPath: file.oldPath === undefined ? null : replaceUnprintable(file.oldPath),
    text: file.truncated ? dropLastHunk(cleaned) : cleaned,
    truncated: file.truncated
  }
}

/** What {@link toPanePatch} needs. */
interface ToPanePatchInput {
  /** The viewed session. */
  readonly sessionId: string
  /** The selected node's key. */
  readonly key: string
  /** The service's patch for the node's agent. */
  readonly dto: WorktreePatchDto
  /** When the patch is stored, in milliseconds since the epoch. */
  readonly nowMs: number
}

/**
 * Turns the service's patch into plain data for `$.state`: every repository-controlled string
 * cleaned, a file the service cut trimmed back to whole hunks, and the files cut to
 * {@link PATCH_CHAR_BUDGET} characters in all.
 *
 * @param input - The ids, the service's patch and the time.
 * @returns A `ready` patch, whose `failure` says why it has no files when git or the diff failed.
 */
export function toPanePatch(input: ToPanePatchInput): PanePatch {
  const { sessionId, key, dto, nowMs } = input
  const base = emptyPanePatch({ sessionId, key, status: 'ready', nowMs })
  if (dto.kind === 'unavailable') return { ...base, failure: { git: dto.git } }
  if (dto.kind === 'failed') return { ...base, failure: { code: dto.code } }
  const { files, omittedCount } = cutPatches(dto.files.map(toFile), PATCH_CHAR_BUDGET)
  return { ...base, files, omittedCount, uncommitted: dto.uncommitted }
}
