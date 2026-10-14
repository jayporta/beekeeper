import type { FileDiffHunkDto } from '../../../../../shared/ipc/fileDiffDto'

/**
 * Writes hunks as unified-diff text: an `@@ -old +new @@` header for each,
 * then its lines.
 *
 * @param hunks - The recorded hunks, in order.
 * @returns The patch text, each line ending in a newline; empty for no hunks.
 */
export function hunksToPatch(hunks: readonly FileDiffHunkDto[]): string {
  return hunks
    .map(
      (hunk) =>
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n` +
        hunk.lines.map((line) => `${line}\n`).join('')
    )
    .join('')
}
