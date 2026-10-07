import { constants } from 'node:fs'
import { open, type FileHandle } from 'node:fs/promises'
import { errorCode } from '../shared/errorCode'
import { err, ok, type Result } from '../shared/result'
import { isMissingEntryError } from './isMissingEntryError'

/**
 * Why a JSON file couldn't be read by {@link readBoundedJsonFile}.
 *
 * `missing` when the file doesn't exist. `symlink` when the path's last
 * component is a symlink, rejected rather than followed. `not-a-file` when
 * it opens but isn't a regular file (a directory, FIFO, or other special
 * file). `too-large` when it exceeds the byte cap. `invalid-json` when it
 * isn't parseable JSON.
 */
export type BoundedJsonErrorReason =
  'missing' | 'symlink' | 'not-a-file' | 'too-large' | 'invalid-json'

/** Why {@link readBoundedJsonFile} could not produce a parsed value. */
export interface BoundedJsonError {
  readonly reason: BoundedJsonErrorReason
}

/**
 * Reads one small JSON file without trusting its size, type, or location.
 *
 * Opens the path itself with `O_NOFOLLOW` so a symlink is rejected rather
 * than followed, and with `O_NONBLOCK` so a FIFO with no writer can't hang
 * the open. Every check after that, including the size cap, runs against the
 * same open file descriptor (`fstat` and `read`, not `stat` and a separate
 * `readFile`), so nothing the path resolves to can change between checks.
 * The read buffer holds `maxBytes` plus one byte, whatever size `fstat`
 * reported, so a file written between the check and the read is still read
 * whole. It's filled in a loop that keeps calling `read` until it returns
 * `0` (real end of file) or the buffer is full, since a single `read` call
 * can legally return fewer bytes than requested and a short read must never
 * be mistaken for the whole file. Filling the buffer completely means the
 * file has grown past the cap, so the cap holds even against a file that
 * grows after the check.
 *
 * A missing file, a symlink, a non-regular file, an oversized one, and
 * invalid JSON are all reported as an {@link err} rather than thrown. The
 * parsed value is returned as `unknown`; callers validate its shape.
 *
 * @param path - Absolute path to the JSON file.
 * @param maxBytes - The largest file size, in bytes, that is read.
 * @returns `ok` with the parsed JSON, or an `err` describing why it
 * couldn't be read.
 * @throws {Error} When the file exists but can't be read for a reason
 * other than the ones above, such as a permissions error. Callers that
 * must isolate this failure to one file should catch it and capture it as
 * a `Result` (see `captureSystemError`).
 */
export async function readBoundedJsonFile(
  path: string,
  maxBytes: number
): Promise<Result<unknown, BoundedJsonError>> {
  let handle: FileHandle | undefined

  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)

    const stats = await handle.stat()
    if (!stats.isFile()) return err({ reason: 'not-a-file' })
    if (stats.size > maxBytes) return err({ reason: 'too-large' })

    const bufferSize = maxBytes + 1
    const buffer = Buffer.alloc(bufferSize)
    let totalRead = 0
    while (totalRead < bufferSize) {
      const { bytesRead } = await handle.read(buffer, totalRead, bufferSize - totalRead, totalRead)
      if (bytesRead === 0) break
      totalRead += bytesRead
    }
    if (totalRead === bufferSize) return err({ reason: 'too-large' })

    try {
      return ok(JSON.parse(buffer.toString('utf-8', 0, totalRead)) as unknown)
    } catch {
      return err({ reason: 'invalid-json' })
    }
  } catch (error) {
    if (isMissingEntryError(error)) return err({ reason: 'missing' })
    if (errorCode(error) === 'ELOOP') return err({ reason: 'symlink' })
    throw error
  } finally {
    await handle?.close()
  }
}
