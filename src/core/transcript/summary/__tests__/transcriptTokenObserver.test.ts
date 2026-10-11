import { describe, expect, it } from 'vitest'
import { buildAssistantRecord } from '../../testFixtures'
import { recordTimestampMs } from '../recordTimestampMs'
import {
  createTranscriptTokenObserver,
  MAX_MESSAGE_IDS,
  TRACKED_MESSAGE_OVERHEAD,
  type TranscriptTokenObserver
} from '../transcriptTokenObserver'

/** Feeds a record with the timestamp the summary scan would read from it. */
function feed(observer: TranscriptTokenObserver, record: Record<string, unknown>): void {
  observer.observe(record, recordTimestampMs(record))
}

describe('createTranscriptTokenObserver', () => {
  it('reports no total when no assistant record was seen', () => {
    const observer = createTranscriptTokenObserver()
    feed(observer, { type: 'user' })

    expect(observer.total()).toBeNull()
  })

  it('counts records sharing a message id once, taking each token class at its maximum', () => {
    const observer = createTranscriptTokenObserver()
    feed(observer, buildAssistantRecord({ messageId: 'msg_a', inputTokens: 10, outputTokens: 1 }))
    feed(observer, buildAssistantRecord({ messageId: 'msg_a', inputTokens: 2, outputTokens: 25 }))

    expect(observer.total()).toBe(35)
  })

  it('adds up messages with different ids', () => {
    const observer = createTranscriptTokenObserver()
    feed(observer, buildAssistantRecord({ messageId: 'msg_a', inputTokens: 1, outputTokens: 2 }))
    feed(observer, buildAssistantRecord({ messageId: 'msg_b', inputTokens: 4, outputTokens: 8 }))

    expect(observer.total()).toBe(15)
  })

  it('sums a record whose usage has more than one iteration, not its top-level counts', () => {
    const observer = createTranscriptTokenObserver()
    feed(
      observer,
      buildAssistantRecord({
        inputTokens: 1,
        outputTokens: 1,
        usageExtra: {
          iterations: [
            { input_tokens: 40, output_tokens: 20 },
            { input_tokens: 60, output_tokens: 30 }
          ]
        }
      })
    )

    expect(observer.total()).toBe(150)
  })

  it('counts every token class', () => {
    const observer = createTranscriptTokenObserver()
    feed(
      observer,
      buildAssistantRecord({
        inputTokens: 1,
        outputTokens: 2,
        usageExtra: {
          cache_read_input_tokens: 4,
          cache_creation: { ephemeral_5m_input_tokens: 8, ephemeral_1h_input_tokens: 16 }
        }
      })
    )

    expect(observer.total()).toBe(31)
  })

  it('ignores an assistant record with no usage and does not throw', () => {
    const observer = createTranscriptTokenObserver()
    feed(observer, { type: 'assistant', message: { id: 'msg_x', model: 'm' } })

    expect(observer.total()).toBeNull()
  })

  it('reports a total of zero for a message that used no tokens', () => {
    const observer = createTranscriptTokenObserver()
    feed(observer, buildAssistantRecord({ inputTokens: 0, outputTokens: 0 }))

    expect(observer.total()).toBe(0)
  })

  it('reports no total when the sum is not finite', () => {
    const observer = createTranscriptTokenObserver()
    feed(observer, buildAssistantRecord({ messageId: 'msg_a', inputTokens: 1e308 }))
    feed(observer, buildAssistantRecord({ messageId: 'msg_b', inputTokens: 1e308 }))

    expect(observer.total()).toBeNull()
  })

  describe('leadUsage', () => {
    const SLOT_MS = 15 * 60 * 1000
    const slotOf = (iso: string): number => Math.floor(Date.parse(iso) / SLOT_MS)

    it('places a message in the slot of its earliest record even when the later line is earlier', () => {
      const observer = createTranscriptTokenObserver()
      feed(
        observer,
        buildAssistantRecord({ messageId: 'msg_a', timestamp: '2026-01-01T12:20:00.000Z' })
      )
      feed(
        observer,
        buildAssistantRecord({ messageId: 'msg_a', timestamp: '2026-01-01T12:05:00.000Z' })
      )

      expect(observer.leadUsage()?.slots.map((s) => s.slot)).toEqual([
        slotOf('2026-01-01T12:00:00.000Z')
      ])
    })

    it('ignores a record with no timestamp when finding the earliest', () => {
      const observer = createTranscriptTokenObserver()
      feed(
        observer,
        buildAssistantRecord({ messageId: 'msg_a', timestamp: '2026-01-01T12:20:00.000Z' })
      )
      feed(observer, { ...buildAssistantRecord({ messageId: 'msg_a' }), timestamp: undefined })

      expect(observer.leadUsage()?.undatedMessages).toBe(0)
      expect(observer.leadUsage()?.slots).toHaveLength(1)
    })

    it('counts a message none of whose records has a timestamp as undated', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, { ...buildAssistantRecord({ messageId: 'msg_a' }), timestamp: undefined })

      expect(observer.leadUsage()?.undatedMessages).toBe(1)
    })

    it('uses the model of the first record that carried the id', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, buildAssistantRecord({ messageId: 'msg_a', model: 'model-first' }))
      feed(observer, buildAssistantRecord({ messageId: 'msg_a', model: 'model-second' }))

      expect(observer.leadUsage()?.slots.map((s) => s.model)).toEqual(['model-first'])
    })

    it('takes each token class at its maximum across a message records', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, buildAssistantRecord({ messageId: 'msg_a', inputTokens: 10, outputTokens: 1 }))
      feed(observer, buildAssistantRecord({ messageId: 'msg_a', inputTokens: 2, outputTokens: 25 }))

      expect(observer.leadUsage()?.slots.map((s) => s.tokens)).toEqual([35])
    })

    it('lists every valid message id', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, buildAssistantRecord({ messageId: 'msg_a' }))
      feed(observer, buildAssistantRecord({ messageId: 'msg_b' }))

      expect([...(observer.leadUsage()?.messageIds ?? [])]).toEqual(['msg_a', 'msg_b'])
    })

    it('lists the ids of synthetic and zero-token messages though no slot counts them', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, buildAssistantRecord({ messageId: 'msg_syn', model: '<synthetic>' }))
      feed(
        observer,
        buildAssistantRecord({ messageId: 'msg_zero', inputTokens: 0, outputTokens: 0 })
      )

      expect(observer.leadUsage()?.slots).toEqual([])
      expect([...(observer.leadUsage()?.messageIds ?? [])]).toEqual(['msg_syn', 'msg_zero'])
    })

    it('leaves a usage it already returned unchanged by the records observed after it', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, buildAssistantRecord({ messageId: 'msg_a', inputTokens: 5 }))
      const earlier = observer.leadUsage()
      const slots = structuredClone(earlier?.slots)

      feed(observer, buildAssistantRecord({ messageId: 'msg_a', inputTokens: 50 }))
      feed(observer, buildAssistantRecord({ messageId: 'msg_b' }))

      expect(earlier?.slots).toEqual(slots)
      expect([...(earlier?.messageIds ?? [])]).toEqual(['msg_a'])
    })

    it('hands out the same ids again while no new id has arrived', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, buildAssistantRecord({ messageId: 'msg_a' }))
      const first = observer.leadUsage()?.messageIds
      feed(observer, buildAssistantRecord({ messageId: 'msg_a', inputTokens: 9 }))

      expect(observer.leadUsage()?.messageIds).toBe(first)
    })

    it('counts an assistant record that fails the schema', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, { type: 'assistant', message: { id: 'msg_x', model: 'm' } })

      expect(observer.leadUsage()?.invalidAssistantRecords).toBe(1)
    })

    it('does not count a record that is not an assistant record', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, { type: 'user' })

      expect(observer.leadUsage()?.invalidAssistantRecords).toBe(0)
    })

    it('is empty and not null when no assistant record was seen', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, { type: 'user' })

      expect(observer.leadUsage()).toEqual({
        slots: [],
        undatedMessages: 0,
        invalidAssistantRecords: 0,
        messageIds: new Set()
      })
    })

    it('is empty with the invalid records counted when every assistant record is invalid', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, { type: 'assistant', message: { id: 'msg_x', model: 'm' } })

      expect(observer.leadUsage()).toEqual({
        slots: [],
        undatedMessages: 0,
        invalidAssistantRecords: 1,
        messageIds: new Set()
      })
    })

    it('is null once a distinct id past the cap arrives', () => {
      const observer = createTranscriptTokenObserver()
      for (let i = 0; i <= MAX_MESSAGE_IDS; i += 1) {
        feed(observer, buildAssistantRecord({ messageId: `msg_${i}`, inputTokens: 1 }))
      }

      expect(observer.leadUsage()).toBeNull()
    })

    it('is still available when the distinct ids are exactly the cap', () => {
      const observer = createTranscriptTokenObserver()
      for (let i = 0; i < MAX_MESSAGE_IDS; i += 1) {
        feed(observer, buildAssistantRecord({ messageId: `msg_${i}`, inputTokens: 1 }))
      }

      expect(observer.leadUsage()?.messageIds.size).toBe(MAX_MESSAGE_IDS)
    })
  })

  describe('with more distinct message ids than the cap', () => {
    const observeIds = (observer: TranscriptTokenObserver, count: number): void => {
      for (let i = 0; i < count; i += 1) {
        feed(
          observer,
          buildAssistantRecord({ messageId: `msg_${i}`, inputTokens: 1, outputTokens: 0 })
        )
      }
    }

    it('still totals when the distinct ids are exactly the cap', () => {
      const observer = createTranscriptTokenObserver()
      observeIds(observer, MAX_MESSAGE_IDS)

      expect(observer.total()).toBe(MAX_MESSAGE_IDS)
    })

    it('reports no total once one more distinct id arrives', () => {
      const observer = createTranscriptTokenObserver()
      observeIds(observer, MAX_MESSAGE_IDS + 1)

      expect(observer.total()).toBeNull()
    })

    it('keeps reporting no total after the cap is passed, even for an id seen before', () => {
      const observer = createTranscriptTokenObserver()
      observeIds(observer, MAX_MESSAGE_IDS + 1)
      feed(observer, buildAssistantRecord({ messageId: 'msg_0', inputTokens: 5 }))

      expect(observer.total()).toBeNull()
    })

    it('still merges a repeat of an id seen before the cap is reached', () => {
      const observer = createTranscriptTokenObserver()
      observeIds(observer, MAX_MESSAGE_IDS)
      feed(observer, buildAssistantRecord({ messageId: 'msg_0', inputTokens: 5, outputTokens: 0 }))

      expect(observer.total()).toBe(MAX_MESSAGE_IDS + 4)
    })
  })

  describe('weight', () => {
    it('is zero before any assistant record', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, { type: 'user' })

      expect(observer.weight()).toBe(0)
    })

    it('charges each distinct message its overhead, its id and its model', () => {
      const observer = createTranscriptTokenObserver()
      // Undated, so the messages fill no slot.
      observer.observe(buildAssistantRecord({ messageId: 'msg_a', model: 'model-one' }), null)
      observer.observe(buildAssistantRecord({ messageId: 'msg_bb', model: 'model-22' }), null)

      expect(observer.weight()).toBe(
        2 * TRACKED_MESSAGE_OVERHEAD +
          'msg_a'.length +
          'model-one'.length +
          'msg_bb'.length +
          'model-22'.length
      )
    })

    it('weighs more for messages spread over more slots', () => {
      const oneSlot = createTranscriptTokenObserver()
      const twoSlots = createTranscriptTokenObserver()
      for (const [observer, laterAt] of [
        [oneSlot, '2026-01-01T00:05:00.000Z'],
        [twoSlots, '2026-01-01T00:20:00.000Z']
      ] as const) {
        feed(observer, buildAssistantRecord({ messageId: 'msg_a' }))
        feed(observer, buildAssistantRecord({ messageId: 'msg_b', timestamp: laterAt }))
      }

      expect(twoSlots.weight()).toBeGreaterThan(oneSlot.weight())
    })

    it('does not change when its lead usage is read, since a cache weighs it once', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, buildAssistantRecord({ messageId: 'msg_a' }))
      const unread = observer.weight()

      observer.leadUsage()

      expect(observer.weight()).toBe(unread)
    })

    it('does not charge a repeat of an id again', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, buildAssistantRecord({ messageId: 'msg_a', model: 'model-one' }))
      const once = observer.weight()
      feed(observer, buildAssistantRecord({ messageId: 'msg_a', model: 'model-two' }))

      expect(observer.weight()).toBe(once)
    })

    it('does not charge an assistant record that fails validation', () => {
      const observer = createTranscriptTokenObserver()
      feed(observer, { type: 'assistant', message: { id: 'msg_x' } })

      expect(observer.weight()).toBe(0)
    })

    it('drops to zero once the observer gives up past the id cap', () => {
      const observer = createTranscriptTokenObserver()
      for (let i = 0; i <= MAX_MESSAGE_IDS; i += 1) {
        feed(observer, buildAssistantRecord({ messageId: `msg_${i}` }))
      }

      expect(observer.weight()).toBe(0)
    })
  })
})
