import { describe, expect, it } from 'vitest'
import { buildAssistantRecord } from '../../testFixtures'
import {
  createTranscriptTokenObserver,
  MAX_MESSAGE_IDS,
  type TranscriptTokenObserver
} from '../transcriptTokenObserver'

describe('createTranscriptTokenObserver', () => {
  it('reports no total when no assistant record was seen', () => {
    const observer = createTranscriptTokenObserver()
    observer.observe({ type: 'user' })

    expect(observer.total()).toBeNull()
  })

  it('counts records sharing a message id once, taking each token class at its maximum', () => {
    const observer = createTranscriptTokenObserver()
    observer.observe(buildAssistantRecord({ messageId: 'msg_a', inputTokens: 10, outputTokens: 1 }))
    observer.observe(buildAssistantRecord({ messageId: 'msg_a', inputTokens: 2, outputTokens: 25 }))

    expect(observer.total()).toBe(35)
  })

  it('adds up messages with different ids', () => {
    const observer = createTranscriptTokenObserver()
    observer.observe(buildAssistantRecord({ messageId: 'msg_a', inputTokens: 1, outputTokens: 2 }))
    observer.observe(buildAssistantRecord({ messageId: 'msg_b', inputTokens: 4, outputTokens: 8 }))

    expect(observer.total()).toBe(15)
  })

  it('sums a record whose usage has more than one iteration, not its top-level counts', () => {
    const observer = createTranscriptTokenObserver()
    observer.observe(
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
    observer.observe(
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
    observer.observe({ type: 'assistant', message: { id: 'msg_x', model: 'm' } })

    expect(observer.total()).toBeNull()
  })

  it('reports a total of zero for a message that used no tokens', () => {
    const observer = createTranscriptTokenObserver()
    observer.observe(buildAssistantRecord({ inputTokens: 0, outputTokens: 0 }))

    expect(observer.total()).toBe(0)
  })

  it('reports no total when the sum is not finite', () => {
    const observer = createTranscriptTokenObserver()
    observer.observe(buildAssistantRecord({ messageId: 'msg_a', inputTokens: 1e308 }))
    observer.observe(buildAssistantRecord({ messageId: 'msg_b', inputTokens: 1e308 }))

    expect(observer.total()).toBeNull()
  })

  describe('with more distinct message ids than the cap', () => {
    const observeIds = (observer: TranscriptTokenObserver, count: number): void => {
      for (let i = 0; i < count; i += 1) {
        observer.observe(
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
      observer.observe(buildAssistantRecord({ messageId: 'msg_0', inputTokens: 5 }))

      expect(observer.total()).toBeNull()
    })

    it('still merges a repeat of an id seen before the cap is reached', () => {
      const observer = createTranscriptTokenObserver()
      observeIds(observer, MAX_MESSAGE_IDS)
      observer.observe(
        buildAssistantRecord({ messageId: 'msg_0', inputTokens: 5, outputTokens: 0 })
      )

      expect(observer.total()).toBe(MAX_MESSAGE_IDS + 4)
    })
  })
})
