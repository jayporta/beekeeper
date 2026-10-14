import { keepWholeHunks } from './hunks'
import type { PanePatchFile } from './panePatch'

/** The files that fit a budget, and how many were left out. */
export interface CutPatches {
  /** The files kept, in order; the one that crossed the budget is cut at a hunk. */
  readonly files: readonly PanePatchFile[]
  /** Files dropped: empty ones (the service's total cap left them out), the one that did not fit even a header and first hunk, and every file after the budget ran out. */
  readonly omittedCount: number
}

/**
 * Keeps files in order while their text fits a character budget. The file that crosses it is cut
 * at the last hunk that fits, and dropped when not even its header and first hunk do; files
 * after it are dropped. A file with no text is counted, never kept.
 *
 * @param files - The files, in git's order.
 * @param budget - The most characters of patch text to keep in all.
 * @returns The kept files and the count of those left out.
 */
export function cutPatches(files: readonly PanePatchFile[], budget: number): CutPatches {
  const kept: PanePatchFile[] = []
  let used = 0
  let omitted = 0
  let isFull = false
  for (const file of files) {
    if (file.text === '' || isFull) {
      omitted += 1
      continue
    }
    const text = keepWholeHunks(file.text, budget - used)
    if (text === null) {
      isFull = true
      omitted += 1
      continue
    }
    isFull = text.length < file.text.length
    kept.push(isFull ? { ...file, text, truncated: true } : file)
    used += text.length
  }
  return { files: kept, omittedCount: omitted }
}
