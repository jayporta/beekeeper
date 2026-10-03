import { isPathWithinCap } from '../shared/boundedPath'
import { hasUnprintable } from './hasUnprintable'

/** The longest label kept, in UTF-16 code units. Real folder names run far shorter. */
export const MAX_LABEL_CHARS = 120

/** A bare Windows drive, which names no folder. */
const DRIVE_ONLY = /^[A-Za-z]:$/

/**
 * Derives a project label from a recorded working directory: its last path
 * segment. Splits on both `/` and `\` so a Windows path works on any host,
 * and ignores trailing separators.
 *
 * @param cwd - A working directory read from a transcript, which is untrusted.
 * @returns The last segment, or `null` when the path is over the path cap,
 * names no folder (empty, the root, a bare drive), or the segment is longer
 * than {@link MAX_LABEL_CHARS} or holds an unprintable character.
 */
export function labelFromCwd(cwd: string): string | null {
  if (!isPathWithinCap(cwd)) return null
  const segment = cwd.split(/[\\/]+/).findLast((part) => part.length > 0)
  if (segment === undefined || DRIVE_ONLY.test(segment)) return null
  if (segment.length > MAX_LABEL_CHARS || hasUnprintable(segment)) return null
  return segment
}
