import { constants } from 'node:fs'
import { open, type FileHandle } from 'node:fs/promises'
import { errorCode } from './errorCode'
import { isMissingEntryError } from './isMissingEntryError'
import { err, ok, type Result } from './result'
import { subagentMetaSchema, type SubagentMeta } from './schemas'

/** The largest `.meta.json` file this reads; the largest seen on disk is a few hundred bytes. */
const MAX_META_BYTES = 64 * 1024

/**
 * Why a subagent's `.meta.json` couldn't be read into a valid
 * {@link SubagentMeta}.
 *
 * `missing` when the file doesn't exist, `symlink` when the path's last
 * component is a symlink (rejected rather than followed, since discovery
 * already resolved real meta files and a symlink appearing here means the
 * path changed underneath it), `not-a-file` when it opens but isn't a
 * regular file (a directory, FIFO, or other special file), `too-large`
 * when it exceeds {@link MAX_META_BYTES}, `invalid-json` when it isn't
 * parseable JSON, and `invalid-shape` when it parses but fails schema
 * validation.
 */
export type SubagentMetaErrorReason =
  'missing' | 'symlink' | 'not-a-file' | 'too-large' | 'invalid-json' | 'invalid-shape'

/** Why {@link readSubagentMeta} could not produce a valid {@link SubagentMeta}. */
export interface SubagentMetaError {
  readonly reason: SubagentMetaErrorReason
}

/**
 * Reads and validates one subagent's `.meta.json` sidecar.
 *
 * Opens the path itself with `O_NOFOLLOW` so a symlink swapped in after
 * discovery is rejected rather than followed, and with `O_NONBLOCK` so a
 * FIFO with no writer can't hang the open. Every check after that,
 * including the size cap, runs against the same open file descriptor
 * (`fstat` and `read`, not `stat` and a separate `readFile`), so nothing
 * the path resolves to can change between checks. The read buffer is sized
 * to the file's reported size (capped at {@link MAX_META_BYTES}) plus one
 * byte, and filled in a loop that keeps calling `read` until it returns
 * `0` (real end of file) or the buffer is full, since a single `read` call
 * can legally return fewer bytes than requested and a short read must
 * never be mistaken for the whole file. Filling the buffer completely,
 * without reaching a real end of file, means the file has grown past what
 * `fstat` reported, so that's treated the same as oversized: the cap holds
 * even against a file that grows after the check.
 *
 * A missing file, a symlink, a non-regular file, an oversized one,
 * invalid JSON, and JSON that fails {@link subagentMetaSchema} are all
 * reported as an {@link err} rather than thrown, since a subagent with no
 * usable meta still belongs in the agent tree, just parented to the lead.
 *
 * @param metaPath - Absolute path to the subagent's `.meta.json` file.
 * @returns `ok` with the validated meta, or an `err` describing why it
 * couldn't be read.
 * @throws {Error} When the file exists but can't be read for a reason
 * other than the ones above, such as a permissions error. Callers that
 * must isolate this failure to one subagent should catch it and capture
 * it as a `Result` (see `captureSystemError`).
 */
export async function readSubagentMeta(
  metaPath: string
): Promise<Result<SubagentMeta, SubagentMetaError>> {
  let handle: FileHandle | undefined

  try {
    handle = await open(metaPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)

    const stats = await handle.stat()
    if (!stats.isFile()) return err({ reason: 'not-a-file' })
    if (stats.size > MAX_META_BYTES) return err({ reason: 'too-large' })

    const bufferSize = Math.min(stats.size, MAX_META_BYTES) + 1
    const buffer = Buffer.alloc(bufferSize)
    let totalRead = 0
    while (totalRead < bufferSize) {
      const { bytesRead } = await handle.read(buffer, totalRead, bufferSize - totalRead, totalRead)
      if (bytesRead === 0) break
      totalRead += bytesRead
    }
    if (totalRead === bufferSize) return err({ reason: 'too-large' })

    const raw = buffer.toString('utf-8', 0, totalRead)
    let parsed: unknown
    try {
      parsed = JSON.parse(raw) as unknown
    } catch {
      return err({ reason: 'invalid-json' })
    }

    const result = subagentMetaSchema.safeParse(parsed)
    return result.success ? ok(result.data) : err({ reason: 'invalid-shape' })
  } catch (error) {
    if (isMissingEntryError(error)) return err({ reason: 'missing' })
    if (errorCode(error) === 'ELOOP') return err({ reason: 'symlink' })
    throw error
  } finally {
    await handle?.close()
  }
}
