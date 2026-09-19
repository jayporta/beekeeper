import { createReadStream } from 'node:fs'
import { err, ok, type Result } from './result'

/** The largest line {@link readJsonlLines} will buffer, in UTF-16 code units, by default. */
const DEFAULT_MAX_LINE_CHARS = 64 * 1024 * 1024

/** Tuning for {@link readJsonlLines}, mainly so tests can force a chunk boundary or a small line cap. */
export interface ReadJsonlLinesOptions {
  /** Overrides the read stream's internal chunk size, in bytes. */
  readonly highWaterMark?: number
  /**
   * The largest line the reader will hold in memory, measured in UTF-16
   * code units (a JS string's `length`). A line at or past this size is
   * reported as a {@link LineTooLongError} instead of being buffered, so a
   * hostile or corrupted transcript cannot exhaust memory. Defaults to 64
   * Mi code units; real transcript lines reach about 3.1 MB.
   */
  readonly maxLineChars?: number
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
 * partially. A line that crosses `maxLineChars` is reported once, right
 * when its terminator is found; memory held for it is bounded to roughly
 * `maxLineChars` plus one chunk, never its full length. The underlying
 * stream is closed if the caller stops iterating before the file ends.
 *
 * @param filePath - Absolute path to the `.jsonl` file to read.
 * @param options - Stream tuning, mainly for tests.
 * @returns An async generator of line results, in file order.
 * @throws {Error} When `filePath` does not exist or cannot be read. The
 * error surfaces by rejecting the generator's first `next()` call.
 */
export async function* readJsonlLines(
  filePath: string,
  options: ReadJsonlLinesOptions = {}
): AsyncGenerator<Result<string, LineTooLongError>, void, void> {
  const stream = createReadStream(filePath, { highWaterMark: options.highWaterMark })
  const maxLineChars = options.maxLineChars ?? DEFAULT_MAX_LINE_CHARS
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let scanFrom = 0
  let discardingOversizedLine = false

  // Drives the stream's iterator manually, rather than with `for await`, so
  // that closing the stream on early exit is this function's own doing (see
  // the `finally` below) and not something the runtime does on our behalf.
  const chunks = (stream as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]()

  try {
    for (;;) {
      const next = await chunks.next()
      if (next.done) break

      buffer += decoder.decode(next.value, { stream: true })

      for (;;) {
        const newlineIndex = buffer.indexOf('\n', scanFrom)

        if (newlineIndex === -1) {
          // `>` rather than `>=`: leaves room for a lone trailing `\r`
          // that a `\n` in the next chunk would still strip, so a
          // borderline CRLF line isn't flagged early on a false alarm.
          if (discardingOversizedLine || buffer.length > maxLineChars) {
            // Drop what's buffered so a line with no terminator in sight
            // never grows past one chunk, whether it crossed the cap in
            // this chunk or an earlier one.
            discardingOversizedLine = true
            buffer = ''
            scanFrom = 0
          } else {
            scanFrom = buffer.length
          }
          break
        }

        const rawLine = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)
        scanFrom = 0

        // Strip the CR before the length check, so a CRLF line isn't
        // penalized one character versus the same line ending in bare `\n`.
        const line = stripTrailingCarriageReturn(rawLine)

        if (discardingOversizedLine || line.length >= maxLineChars) {
          discardingOversizedLine = false
          yield err({ reason: 'line-too-long' })
          continue
        }

        if (line.length > 0) yield ok(line)
      }
    }
  } finally {
    stream.destroy()
  }
}

function stripTrailingCarriageReturn(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line
}
