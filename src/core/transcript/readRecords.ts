import { isRecordObject } from './isRecordObject'
import { parseRecord } from './parseRecord'
import { readJsonlLines, type ReadJsonlLinesOptions } from './readJsonlLines'
import { err, ok, type Result } from './result'

/**
 * Why a transcript line didn't yield a record: it was too long to buffer,
 * wasn't valid JSON, or parsed to valid JSON that isn't an object.
 */
export interface SkippedLineError {
  /** Which of the three reasons the line couldn't yield a record. */
  readonly reason: 'line-too-long' | 'invalid-json' | 'not-an-object'
}

/**
 * Streams a transcript file and yields a {@link Result} for each
 * newline-terminated line: `ok` with the line parsed as a JSON object, or
 * an `err` describing why it couldn't be. Combines {@link readJsonlLines},
 * {@link parseRecord}, and {@link isRecordObject} into the one loop every
 * transcript scan repeats; shape validation against a specific record
 * schema still happens in the caller.
 *
 * @param filePath - Absolute path to the `.jsonl` transcript to read.
 * @param options - Stream tuning, mainly for tests.
 * @returns An async generator of record results, in file order.
 * @throws {Error} When `filePath` does not exist or cannot be read.
 */
export async function* readRecords(
  filePath: string,
  options: ReadJsonlLinesOptions = {}
): AsyncGenerator<Result<Record<string, unknown>, SkippedLineError>, void, void> {
  for await (const line of readJsonlLines(filePath, options)) {
    if (!line.ok) {
      yield err({ reason: 'line-too-long' })
      continue
    }

    const parsed = parseRecord(line.value)
    if (!parsed.ok) {
      yield err({ reason: 'invalid-json' })
      continue
    }

    if (!isRecordObject(parsed.value)) {
      yield err({ reason: 'not-an-object' })
      continue
    }

    yield ok(parsed.value)
  }
}
