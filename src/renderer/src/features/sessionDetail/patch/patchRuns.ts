/** What a run of patch lines is: added, removed, or neither. */
export type PatchRunKind = 'add' | 'remove' | 'other'

/** Consecutive patch lines of one kind. */
export interface PatchRun {
  /** What the lines are. */
  readonly kind: PatchRunKind
  /** The lines' text, newlines included, exactly as in the patch. */
  readonly text: string
}

const PLUS = 0x2b
const MINUS = 0x2d

function kindOf(firstChar: number): PatchRunKind {
  if (firstChar === PLUS) return 'add'
  if (firstChar === MINUS) return 'remove'
  return 'other'
}

/**
 * Groups a patch's lines into runs that start alike, for coloring. A line is
 * added if it starts with `+`, removed if it starts with `-`, and neither
 * otherwise. Nothing else about the text is read, so the file headers `---`
 * and `+++` take the color of their first character like any other line.
 * Joining the runs gives the patch back, character for character. Grouping
 * keeps a large patch to a few elements per change.
 *
 * @param patch - A patch as plain text.
 * @returns The runs, in order.
 */
export function patchRuns(patch: string): readonly PatchRun[] {
  const runs: PatchRun[] = []
  let start = 0
  let kind: PatchRunKind | undefined
  let at = 0
  while (at < patch.length) {
    const end = patch.indexOf('\n', at)
    const next = end === -1 ? patch.length : end + 1
    const lineKind = kindOf(patch.charCodeAt(at))
    if (kind !== undefined && lineKind !== kind) {
      runs.push({ kind, text: patch.slice(start, at) })
      start = at
    }
    kind = lineKind
    at = next
  }
  if (kind !== undefined) runs.push({ kind, text: patch.slice(start) })
  return runs
}
