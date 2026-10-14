/** The offsets where a hunk header (a line starting with `@@`) begins. */
function hunkStarts(text: string): number[] {
  const starts: number[] = []
  for (let offset = 0; offset < text.length;) {
    if (text.startsWith('@@', offset)) starts.push(offset)
    const next = text.indexOf('\n', offset)
    if (next === -1) break
    offset = next + 1
  }
  return starts
}

/**
 * Whether the text holds at least one hunk header, which is what makes it a unified diff the
 * engine can draw as one. Binary, mode-only and rename-only patches have none.
 *
 * @param text - A file's patch.
 * @returns `true` when a line starts with `@@`.
 */
export function hasHunk(text: string): boolean {
  return hunkStarts(text).length > 0
}

/**
 * How the engine should draw a file's patch: as a unified diff when it holds a hunk, otherwise as
 * plain source, which is what binary, mode-only and rename-only patches are.
 *
 * @param text - A file's patch.
 * @returns The `format` for `Code`.
 */
export function codeFormat(text: string): 'diff' | 'source' {
  return hasHunk(text) ? 'diff' : 'source'
}

/**
 * Drops a patch's last hunk, which a cap may have cut in the middle, so what remains is whole
 * hunks under the header. A patch without hunks comes back unchanged.
 *
 * @param text - A patch cut by a cap.
 * @returns The text up to the start of its last hunk.
 */
export function dropLastHunk(text: string): string {
  const last = hunkStarts(text).at(-1)
  return last === undefined ? text : text.slice(0, last)
}

/**
 * Cuts a patch to at most `maxLength` characters at a hunk boundary.
 *
 * @param text - A patch.
 * @param maxLength - The most characters to keep.
 * @returns The longest prefix of whole hunks (the header and at least the first hunk) within
 * `maxLength`, the text itself when it fits, or `null` when not even the header and first hunk fit.
 */
export function keepWholeHunks(text: string, maxLength: number): string | null {
  if (text.length <= maxLength) return text
  const starts = hunkStarts(text)
  const first = starts[0]
  if (first === undefined) return null
  const end = starts.filter((start) => start > first && start <= maxLength).at(-1)
  return end === undefined ? null : text.slice(0, end)
}
