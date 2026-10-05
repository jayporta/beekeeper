import type { PatchFile } from './parseDiffPatch'

/** The most bytes of one file's patch that are kept: 200 KB. */
export const MAX_FILE_PATCH_BYTES = 200 * 1024

/** The most bytes of patches that are kept in all: 2 MB. */
export const MAX_TOTAL_PATCH_BYTES = 2 * 1024 * 1024

/** One file's patch as text, cut to the caps. */
export interface CappedPatchFile {
  /** The file's path, or for a rename or copy its new path. Repo-controlled. */
  readonly path: string
  /** The path a rename or copy came from. Repo-controlled. */
  readonly oldPath?: string
  /** The patch as text, cut at a whole line when it was cut. Empty when the total cap was already reached. Repo-controlled. */
  readonly patch: string
  /** Whether the patch was cut, or left out, to stay within a cap. */
  readonly truncated: boolean
}

/** The patches within the caps. */
export interface CappedPatches {
  /** Every file, in order. */
  readonly files: readonly CappedPatchFile[]
  /** Whether the total cap cut a patch or left one out. */
  readonly truncatedTotal: boolean
}

/** The caps {@link capPatches} applies. */
export interface PatchLimits {
  /** The most bytes of one file's patch. */
  readonly perFile: number
  /** The most bytes of every patch together. */
  readonly total: number
}

const DEFAULT_LIMITS: PatchLimits = { perFile: MAX_FILE_PATCH_BYTES, total: MAX_TOTAL_PATCH_BYTES }

/** How many bytes at the end of `bytes` start a UTF-8 character that the bytes cut short. */
function incompleteTail(bytes: Buffer): number {
  for (let at = bytes.length - 1; at >= Math.max(0, bytes.length - 3); at -= 1) {
    const byte = bytes[at] ?? 0
    if ((byte & 0xc0) === 0x80) continue
    const width = byte >= 0xf0 ? 4 : byte >= 0xe0 ? 3 : byte >= 0xc0 ? 2 : 1
    return bytes.length - at < width ? bytes.length - at : 0
  }
  return 0
}

/** Cuts a patch to at most `limit` bytes at a whole line, or when it has none, at a whole character. */
function cutBytes(patch: Buffer, limit: number): Buffer {
  const head = patch.subarray(0, limit)
  const lastLine = head.lastIndexOf(0x0a)
  if (lastLine !== -1) return head.subarray(0, lastLine + 1)
  return head.subarray(0, head.length - incompleteTail(head))
}

/**
 * Keeps each file's patch within a per-file cap and all of them within a
 * total cap, so a huge diff can't fill the renderer. A patch over a cap is
 * cut at its last whole line and marked; once the total is spent, the files
 * left keep their paths with an empty, marked patch.
 *
 * @param files - The patches, in order.
 * @param limits - The caps in bytes. Defaults to {@link MAX_FILE_PATCH_BYTES} and {@link MAX_TOTAL_PATCH_BYTES}.
 * @returns The files as text, and whether the total cap was reached.
 */
export function capPatches(
  files: readonly PatchFile[],
  limits: PatchLimits = DEFAULT_LIMITS
): CappedPatches {
  let remaining = limits.total
  let truncatedTotal = false
  const capped = files.map((file): CappedPatchFile => {
    const allowed = Math.max(0, Math.min(limits.perFile, remaining))
    const base = {
      path: file.path,
      ...(file.oldPath === undefined ? {} : { oldPath: file.oldPath })
    }
    if (file.patch.length <= allowed) {
      remaining -= file.patch.length
      return { ...base, patch: file.patch.toString('utf-8'), truncated: false }
    }
    if (remaining < limits.perFile) truncatedTotal = true
    const kept = cutBytes(file.patch, allowed)
    remaining -= kept.length
    return { ...base, patch: kept.toString('utf-8'), truncated: true }
  })
  return { files: capped, truncatedTotal }
}
