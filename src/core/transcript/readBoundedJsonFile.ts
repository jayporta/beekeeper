import { fileSystem } from '../io/installFileSystem'
import { err, ok, type Result } from '../shared/result'

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
 * The bytes come from the port's `readNoFollow`, which refuses a symlink and
 * a non-regular file and caps the size (see `FileSystemPort.readNoFollow`).
 * Those refusals, a missing file and invalid JSON are all reported as an
 * {@link err} rather than thrown. The parsed value is returned as `unknown`;
 * callers validate its shape.
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
  const read = await fileSystem().readNoFollow(path, maxBytes)
  if (!read.ok) return read

  try {
    return ok(
      JSON.parse(new TextDecoder('utf-8', { ignoreBOM: true }).decode(read.value)) as unknown
    )
  } catch {
    return err({ reason: 'invalid-json' })
  }
}
