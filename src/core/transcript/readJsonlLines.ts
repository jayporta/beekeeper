import { createReadStream } from 'node:fs'
import { err, ok, type Result } from '../shared/result'

/** The largest line {@link readJsonlLines} will buffer, in UTF-16 code units, by default. */
const DEFAULT_MAX_LINE_CHARS = 64 * 1024 * 1024

/**
 * The byte `\n` encodes to. No other UTF-8 sequence contains it, so the k-th
 * `\n` in the decoded text is the k-th such byte in the raw chunks.
 */
export const NEWLINE_BYTE = 0x0a

/**
 * Where a {@link readJsonlLines} read stands, in bytes from the start of the
 * file. The caller owns the object and passes it as the `cursor` option; the
 * reader writes `offset` and never reads it.
 */
export interface ReadCursor {
  /**
   * The byte offset just past the last newline the reader consumed: the
   * `start` option's value until the first newline, and the start of the line
   * still in progress afterwards. A later read passed this as `start` begins
   * exactly where this one stopped.
   */
  offset: number
}

/** Tuning for {@link readJsonlLines}, mainly so tests can force a chunk boundary or a small line cap. */
export interface ReadJsonlLinesOptions {
  /** Overrides the read stream's internal chunk size, in bytes. */
  readonly highWaterMark?: number
  /**
   * The largest line the reader will hold in memory, measured in UTF-16
   * code units (a JS string's `length`). A line at or past this size is
   * reported as a {@link LineTooLongError} instead of being buffered, so a
   * hostile or corrupted transcript cannot exhaust memory. Defaults to 64
   * Mi code units.
   */
  readonly maxLineChars?: number
  /**
   * The byte offset to begin reading at, which must be where a line begins,
   * such as a {@link ReadCursor} offset a previous read reported. A byte
   * order mark at that offset is kept as part of the line, as in a full read
   * where only the one at the start of the file is dropped.
   * @defaultValue 0
   */
  readonly start?: number
  /**
   * Receives the byte offset the read has consumed, updated as each newline
   * is consumed and before the line it ends is yielded. It starts at `start`.
   * It stays at the start of a final line that has no terminator, including
   * an oversized one that is being discarded, so a later read resumed from it
   * reads that line again once it ends. Rereading an oversized line costs
   * time bounded by its length.
   */
  readonly cursor?: ReadCursor
}

/** Why a line could not be yielded: it reached {@link ReadJsonlLinesOptions.maxLineChars}. */
export interface LineTooLongError {
  readonly reason: 'line-too-long'
}

/**
 * Streams a JSONL file and yields a {@link Result} for each complete,
 * newline-terminated line: `ok` with the line text, or an `err` when a
 * line reaches `maxLineChars`. Decoding is safe across chunk boundaries,
 * so a multi-byte UTF-8 character split between two chunks is reassembled
 * correctly. A trailing `\r` is stripped, blank lines are skipped, and a
 * final line with no terminating `\n` (a live file caught mid-write, or an
 * oversized line that never finds one) is dropped rather than yielded
 * partially, and the `cursor` option, when given, reports the byte offset
 * where that line begins, so a read resumed there with `start` yields it
 * once it completes. A line that crosses `maxLineChars` is reported once, right
 * when its terminator is found, with memory held for it bounded to
 * roughly `maxLineChars` plus one chunk. The underlying stream is closed
 * if the caller stops iterating before the file ends.
 *
 * @param filePath - Absolute path to the `.jsonl` file to read.
 * @param options - Where to start, a cursor to report the consumed offset
 * through, and stream tuning, mainly for tests.
 * @returns An async generator of line results, in file order.
 * @throws {Error} When `filePath` does not exist or cannot be read. The
 * error surfaces by rejecting the generator's first `next()` call.
 * @throws {RangeError} When `options.start` is negative or not an integer.
 */
export async function* readJsonlLines(
  filePath: string,
  options: ReadJsonlLinesOptions = {}
): AsyncGenerator<Result<string, LineTooLongError>, void, void> {
  const { cursor } = options
  const startOffset = options.start ?? 0
  const stream = createReadStream(filePath, {
    start: startOffset,
    highWaterMark: options.highWaterMark
  })
  const maxLineChars = options.maxLineChars ?? DEFAULT_MAX_LINE_CHARS
  // A decoder drops a leading byte order mark. Only the start of the file can
  // carry one, so a read from a later line keeps a mark there, as a full read does.
  const decoder = new TextDecoder('utf-8', { ignoreBOM: startOffset > 0 })
  if (cursor !== undefined) cursor.offset = startOffset
  // The file offset of the chunk being read.
  let chunkOffset = startOffset
  // The line in progress, kept as decoded pieces and joined once its `\n`
  // arrives, so a long line isn't re-copied on every chunk.
  const pending: string[] = []
  let pendingLength = 0
  let discardingOversizedLine = false

  // Drives the stream's iterator manually, rather than with `for await`, so
  // that closing the stream on early exit is this function's own doing (see
  // the `finally` below) and not something the runtime does on our behalf.
  const chunks = (stream as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]()

  try {
    for (;;) {
      const next = await chunks.next()
      if (next.done) break

      const chunk = next.value
      const text = decoder.decode(chunk, { stream: true })
      let start = 0
      let byteEnd = 0

      for (;;) {
        const newlineIndex = text.indexOf('\n', start)

        if (newlineIndex === -1) {
          if (start < text.length) {
            pending.push(start === 0 ? text : text.slice(start))
            pendingLength += text.length - start
          }
          // `>` rather than `>=`: leaves room for a lone trailing `\r`
          // that a `\n` in the next chunk would still strip, so a
          // borderline CRLF line isn't flagged early on a false alarm.
          if (discardingOversizedLine || pendingLength > maxLineChars) {
            // Drop what's pending so a line with no terminator in sight
            // never grows past one chunk, whether it crossed the cap in
            // this chunk or an earlier one.
            discardingOversizedLine = true
            pending.length = 0
            pendingLength = 0
          }
          break
        }

        pending.push(text.slice(start, newlineIndex))
        pendingLength += newlineIndex - start
        start = newlineIndex + 1
        if (cursor !== undefined) {
          byteEnd = chunk.indexOf(NEWLINE_BYTE, byteEnd) + 1
          cursor.offset = chunkOffset + byteEnd
        }

        // Check the length before joining, so an oversized line is never
        // copied whole. A trailing CR doesn't count, so a CRLF line isn't
        // penalized one character versus the same line ending in bare `\n`.
        const lineLength = pendingLength - (endsWithCarriageReturn(pending) ? 1 : 0)
        const oversized = discardingOversizedLine || lineLength >= maxLineChars
        const line = oversized ? '' : stripTrailingCarriageReturn(pending.join(''))
        pending.length = 0
        pendingLength = 0
        discardingOversizedLine = false

        if (oversized) {
          yield err({ reason: 'line-too-long' })
          continue
        }

        if (line.length > 0) yield ok(line)
      }
      chunkOffset += chunk.length
    }
  } finally {
    stream.destroy()
  }
}

/** Whether the last non-empty piece ends with `\r`. */
function endsWithCarriageReturn(pieces: readonly string[]): boolean {
  for (let i = pieces.length - 1; i >= 0; i--) {
    const piece = pieces[i]
    if (piece !== undefined && piece.length > 0) return piece.endsWith('\r')
  }
  return false
}

function stripTrailingCarriageReturn(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line
}
