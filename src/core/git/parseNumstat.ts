import { err, ok, type Result } from '../transcript/result'

/** One file's line counts from `git diff --numstat -z`. */
export interface NumstatEntry {
  /** The file's path, or its new path for a rename. */
  readonly path: string
  /** The path before a rename. Absent for anything else. */
  readonly oldPath?: string
  /** Lines added, or `null` for a binary file. */
  readonly added: number | null
  /** Lines deleted, or `null` for a binary file. */
  readonly deleted: number | null
}

const NUL = 0
const TAB = 9
const decoder = new TextDecoder('utf-8')

function readCount(bytes: Buffer): Result<number | null, 'malformed-numstat'> {
  const text = bytes.toString('latin1')
  if (text === '-') return ok(null)
  return /^\d{1,15}$/.test(text) ? ok(Number(text)) : err('malformed-numstat')
}

/**
 * Parses `git diff --numstat -z` output.
 *
 * @remarks
 * Records are `added TAB deleted TAB path NUL`. Binary files report `-` for
 * both counts. A rename is `added TAB deleted TAB NUL oldPath NUL newPath NUL`.
 * Only the first two tabs are separators, so paths holding tabs or newlines
 * round-trip. Paths that aren't valid UTF-8 are decoded with U+FFFD
 * replacement characters, so distinct invalid paths may compare equal.
 *
 * @param output - Raw bytes from git's stdout.
 * @returns The entries in order, or `malformed-numstat` when a record is truncated or has bad counts.
 */
export function parseNumstat(output: Buffer): Result<NumstatEntry[], 'malformed-numstat'> {
  const entries: NumstatEntry[] = []
  let pos = 0

  const readField = (): Buffer | undefined => {
    const end = output.indexOf(NUL, pos)
    if (end === -1) return undefined
    const field = output.subarray(pos, end)
    pos = end + 1
    return field
  }

  while (pos < output.length) {
    const record = readField()
    if (record === undefined) return err('malformed-numstat')
    const firstTab = record.indexOf(TAB)
    const secondTab = firstTab === -1 ? -1 : record.indexOf(TAB, firstTab + 1)
    if (secondTab === -1) return err('malformed-numstat')

    const added = readCount(record.subarray(0, firstTab))
    const deleted = readCount(record.subarray(firstTab + 1, secondTab))
    if (!added.ok || !deleted.ok) return err('malformed-numstat')

    const pathBytes = record.subarray(secondTab + 1)
    if (pathBytes.length > 0) {
      entries.push({
        path: decoder.decode(pathBytes),
        added: added.value,
        deleted: deleted.value
      })
      continue
    }
    const oldPath = readField()
    const newPath = readField()
    if (oldPath === undefined || newPath === undefined) return err('malformed-numstat')
    entries.push({
      path: decoder.decode(newPath),
      oldPath: decoder.decode(oldPath),
      added: added.value,
      deleted: deleted.value
    })
  }
  return ok(entries)
}
