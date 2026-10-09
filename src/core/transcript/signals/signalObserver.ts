import { z } from 'zod'
import { messageContentBlocks } from '../messageContentBlocks'
import { toolResultBlockSchema, toolUseBlockSchema } from '../schemas'
import { boundedIdentifierSchema } from '../schemas/boundedIdentifier'
import { recordTimestampMs } from '../summary/recordTimestampMs'
import { commandHash } from './commandHash'
import type { SignalEvent } from './signalEvent'

/**
 * The most signal events one transcript contributes. Past it, nothing more is
 * kept and the observer reports itself capped, so a crafted transcript can't
 * grow the list without bound. Real transcripts peak near 2,200 events.
 */
export const MAX_SIGNAL_EVENTS_PER_TRANSCRIPT = 4096

/** The system record subtypes that become signal events. */
const SYSTEM_SUBTYPE_KINDS = {
  compact_boundary: 'compaction',
  agents_killed: 'agents-killed'
} as const

const bashInputSchema = z.object({ command: z.string() }).loose()

/** A system record's `uuid`: a bounded identifier, and never empty, since an empty one would merge every such event under one ledger key. */
const systemUuidSchema = boundedIdentifierSchema.min(1)

/**
 * Defers reading a record's timestamp until a block needs it, so records with
 * no tool blocks (most assistant text and plain user turns) skip the parse.
 */
function lazyTimestampMs(record: Record<string, unknown>): () => number | null {
  let cached: number | null | undefined
  return () => (cached === undefined ? (cached = recordTimestampMs(record)) : cached)
}

/** Collects signal events from one transcript's records, in a single pass. */
export interface SignalObserver {
  /** Feeds one parsed record to the observer. Records must be observed in file order. */
  observe(record: Record<string, unknown>): void
  /** Every event kept so far, in the order observed. */
  events(): readonly SignalEvent[]
  /** Whether an event arrived after the list was full, so it was dropped. */
  capped(): boolean
}

/**
 * Creates an observer that turns a transcript's tool calls, tool results,
 * compactions and agent kills into signal events. It validates only the
 * fields it reads and tolerates the rest. A Bash command is hashed as it is
 * read and the text is never kept.
 *
 * @returns An observer ready to `observe` a transcript's records in order.
 */
export function createSignalObserver(): SignalObserver {
  const events: SignalEvent[] = []
  let capped = false

  function push(event: SignalEvent): void {
    if (events.length >= MAX_SIGNAL_EVENTS_PER_TRANSCRIPT) {
      capped = true
      return
    }
    events.push(event)
  }

  function observeToolCalls(record: Record<string, unknown>): void {
    const timestamp = lazyTimestampMs(record)
    for (const raw of messageContentBlocks(record)) {
      const block = toolUseBlockSchema.safeParse(raw)
      if (!block.success) continue
      const { id, name } = block.data
      const input = name === 'Bash' ? bashInputSchema.safeParse(block.data.input) : null
      push({
        kind: 'tool-call',
        toolUseId: id,
        tool: name,
        commandHash: input?.success ? commandHash(input.data.command) : null,
        atMs: timestamp()
      })
    }
  }

  function observeToolResults(record: Record<string, unknown>): void {
    const timestamp = lazyTimestampMs(record)
    for (const raw of messageContentBlocks(record)) {
      const block = toolResultBlockSchema.safeParse(raw)
      if (!block.success) continue
      push({
        kind: 'tool-result',
        toolUseId: block.data.tool_use_id,
        isError: block.data.is_error === true,
        atMs: timestamp()
      })
    }
  }

  function observeSystem(record: Record<string, unknown>): void {
    const { subtype } = record
    if (subtype !== 'compact_boundary' && subtype !== 'agents_killed') return
    const uuid = systemUuidSchema.safeParse(record.uuid)
    if (!uuid.success) return
    push({ kind: SYSTEM_SUBTYPE_KINDS[subtype], uuid: uuid.data })
  }

  return {
    observe(record) {
      if (capped) return
      switch (record.type) {
        case 'assistant':
          observeToolCalls(record)
          break
        case 'user':
          observeToolResults(record)
          break
        case 'system':
          observeSystem(record)
          break
      }
    },
    events: () => events,
    capped: () => capped
  }
}
