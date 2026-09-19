import { err, ok, type Result } from './result'

/**
 * Why a line could not be parsed as JSON. Never carries the line's
 * content, since transcripts are untrusted input and must not be logged.
 */
export interface ParseRecordError {
  readonly reason: 'invalid-json'
}

/**
 * Parses one JSONL line as JSON, without validating its shape. Shape
 * validation happens next, against a specific record schema.
 *
 * @param line - A single line of text, with no trailing newline.
 * @returns A {@link Result} holding the parsed value, or an error that
 * never includes the line's content.
 */
export function parseRecord(line: string): Result<unknown, ParseRecordError> {
  try {
    return ok(JSON.parse(line) as unknown)
  } catch {
    return err({ reason: 'invalid-json' })
  }
}
