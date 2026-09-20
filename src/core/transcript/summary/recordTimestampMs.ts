import { timestampSchema } from '../schemas'

/**
 * Reads a record's own `timestamp` field as epoch milliseconds. Only the
 * top-level field counts: a `timestamp` nested inside a record's payload
 * describes something other than when the record was written.
 *
 * @param record - A parsed transcript record.
 * @returns The timestamp in milliseconds since the Unix epoch, or `null`
 * when the record has none or it isn't a parseable date.
 */
export function recordTimestampMs(record: Record<string, unknown>): number | null {
  const parsed = timestampSchema.safeParse(record.timestamp)
  if (!parsed.success || parsed.data === undefined) return null
  return Date.parse(parsed.data)
}
