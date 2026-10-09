/** One thing a transcript record says that a signal count reads. Holds ids and numbers only, never transcript text. */
export type SignalEvent =
  /** A tool call. */
  | {
      readonly kind: 'tool-call'
      /** The call's `tool_use` id. */
      readonly toolUseId: string
      /** The tool's name. */
      readonly tool: string
      /** A hash of a Bash call's `input.command`, or `null` for another tool or an unreadable command. */
      readonly commandHash: number | null
      /** The assistant record's timestamp, in epoch milliseconds, or `null` when it has none. */
      readonly atMs: number | null
    }
  /** A tool call's result. */
  | {
      readonly kind: 'tool-result'
      /** The `tool_use_id` the result answers. */
      readonly toolUseId: string
      /** Whether the result has `is_error: true`. */
      readonly isError: boolean
      /** The user record's timestamp, in epoch milliseconds, or `null` when it has none. */
      readonly atMs: number | null
    }
  /** A `compact_boundary` system record. */
  | {
      readonly kind: 'compaction'
      /** The record's `uuid`. */
      readonly uuid: string
    }
  /** An `agents_killed` system record. */
  | {
      readonly kind: 'agents-killed'
      /** The record's `uuid`. */
      readonly uuid: string
    }

/**
 * The key a session ledger dedupes an event by: its kind and its id, so a
 * fork's copy of the lead's event matches the lead's.
 * @param event - The event.
 * @returns The key.
 */
export function signalEventKey(event: SignalEvent): string {
  const id =
    event.kind === 'tool-call' || event.kind === 'tool-result' ? event.toolUseId : event.uuid
  return `${event.kind}\0${id}`
}
