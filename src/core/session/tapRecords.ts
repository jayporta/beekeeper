import type { SkippedLineError } from '../transcript/readRecords'
import type { Result } from '../transcript/result'

/**
 * Passes a transcript's records through unchanged while showing each valid
 * record to `observe`, so an extra reader can share a pass that another
 * consumer already drives.
 *
 * @param records - The transcript's parsed records, in file order.
 * @param observe - Called with each valid record before it is yielded.
 * @returns The same results, in the same order.
 */
export async function* tapRecords(
  records: AsyncIterable<Result<Record<string, unknown>, SkippedLineError>>,
  observe: (record: Record<string, unknown>) => void
): AsyncGenerator<Result<Record<string, unknown>, SkippedLineError>> {
  for await (const result of records) {
    if (result.ok) observe(result.value)
    yield result
  }
}
