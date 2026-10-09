/**
 * Synthetic `system` records for signal tests. Tool call and result records
 * come from `testFileTouchFixtures`. Never derived from or copied out of a real
 * `~/.claude` transcript.
 */

const DEFAULT_TIMESTAMP = '2026-01-01T00:00:00.000Z'

interface SystemRecordOptions {
  /** The record's `subtype`. */
  readonly subtype: string
  /** The record's `uuid`. */
  readonly uuid: string
}

/** Builds a `system` record. */
export function buildSystemRecord(options: SystemRecordOptions): Record<string, unknown> {
  return {
    type: 'system',
    subtype: options.subtype,
    uuid: options.uuid,
    timestamp: DEFAULT_TIMESTAMP
  }
}
