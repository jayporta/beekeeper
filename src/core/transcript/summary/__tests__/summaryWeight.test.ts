import { describe, expect, it } from 'vitest'
import type { SessionSummary } from '../sessionSummary'
import type { LeadUsage } from '../leadUsage'
import {
  LEAD_ID_OVERHEAD,
  LEAD_SLOT_OVERHEAD,
  SUMMARY_ENTRY_OVERHEAD,
  summaryWeight
} from '../summaryWeight'
import { buildSessionSummary, EMPTY_SIGNALS } from '../testSessionSummary'

const EMPTY_SUMMARY: SessionSummary = buildSessionSummary()

describe('summaryWeight', () => {
  it('charges only the overhead for a summary holding no strings', () => {
    expect(summaryWeight(EMPTY_SUMMARY)).toBe(SUMMARY_ENTRY_OVERHEAD)
  })

  it('adds the length of the title', () => {
    expect(summaryWeight({ ...EMPTY_SUMMARY, title: 'abcd' })).toBe(SUMMARY_ENTRY_OVERHEAD + 4)
  })

  it('adds the length of the model', () => {
    expect(summaryWeight({ ...EMPTY_SUMMARY, model: 'abcde' })).toBe(SUMMARY_ENTRY_OVERHEAD + 5)
  })

  it('adds the length of the longest tool wait tool name', () => {
    const summary: SessionSummary = {
      ...EMPTY_SUMMARY,
      signals: { ...EMPTY_SIGNALS, longestToolWait: { ms: 5, tool: 'abcdef' } }
    }

    expect(summaryWeight(summary)).toBe(SUMMARY_ENTRY_OVERHEAD + 6)
  })

  it('counts UTF-16 code units, so a character outside the BMP weighs two', () => {
    expect(summaryWeight({ ...EMPTY_SUMMARY, title: '😀' })).toBe(SUMMARY_ENTRY_OVERHEAD + 2)
  })

  it('adds every label of an agent role', () => {
    const summary: SessionSummary = {
      ...EMPTY_SUMMARY,
      role: { kind: 'agent', agentType: 'ab', agentName: 'cde', teamName: 'fghi' }
    }

    expect(summaryWeight(summary)).toBe(SUMMARY_ENTRY_OVERHEAD + 9)
  })

  it('adds an agent role own labels and skips its null ones', () => {
    const summary: SessionSummary = {
      ...EMPTY_SUMMARY,
      role: { kind: 'agent', agentType: 'ab', agentName: 'cde', teamName: null }
    }

    expect(summaryWeight(summary)).toBe(SUMMARY_ENTRY_OVERHEAD + 5)
  })

  it('adds every string of each spawn and stop', () => {
    const summary: SessionSummary = {
      ...EMPTY_SUMMARY,
      teamSpawns: {
        spawns: [
          { agentName: 'aa', teamName: 'bbb', agentType: 'c', rawToolUseId: 'dddd' },
          { agentName: 'e', teamName: null, agentType: null, rawToolUseId: null }
        ],
        stops: [{ agentName: 'ff', teamName: 'g' }],
        truncated: false
      }
    }

    // Spawns: 2 + 3 + 1 + 4 and 1. Stop: 2 + 1.
    expect(summaryWeight(summary)).toBe(SUMMARY_ENTRY_OVERHEAD + 14)
  })

  describe('lead usage', () => {
    const leadUsage = (overrides: Partial<LeadUsage>): LeadUsage => ({
      slots: [],
      undatedMessages: 0,
      invalidAssistantRecords: 0,
      messageIds: new Set(),
      ...overrides
    })

    it('adds an overhead and the length for each message id', () => {
      const summary = {
        ...EMPTY_SUMMARY,
        leadUsage: leadUsage({ messageIds: new Set(['ab', 'cde']) })
      }

      expect(summaryWeight(summary)).toBe(SUMMARY_ENTRY_OVERHEAD + 2 * LEAD_ID_OVERHEAD + 5)
    })

    it('adds an overhead and the model length for each slot', () => {
      const summary = {
        ...EMPTY_SUMMARY,
        leadUsage: leadUsage({
          slots: [
            { slot: 1, model: 'abc', tokens: 1 },
            { slot: 2, model: 'de', tokens: 1 }
          ]
        })
      }

      expect(summaryWeight(summary)).toBe(SUMMARY_ENTRY_OVERHEAD + 2 * LEAD_SLOT_OVERHEAD + 5)
    })

    it('adds nothing for an empty lead usage', () => {
      expect(summaryWeight({ ...EMPTY_SUMMARY, leadUsage: leadUsage({}) })).toBe(
        SUMMARY_ENTRY_OVERHEAD
      )
    })

    it('adds nothing for a null lead usage', () => {
      expect(summaryWeight({ ...EMPTY_SUMMARY, leadUsage: null })).toBe(SUMMARY_ENTRY_OVERHEAD)
    })
  })
})
