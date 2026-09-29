import { describe, expect, it } from 'vitest'
import type { SessionSummary } from '../sessionSummary'
import { SUMMARY_ENTRY_OVERHEAD, summaryWeight } from '../summaryWeight'

const EMPTY_SUMMARY: SessionSummary = {
  title: null,
  cost: null,
  activity: null,
  skippedLines: 0,
  role: { kind: 'lead' },
  teamSpawns: { spawns: [], stops: [], truncated: false }
}

describe('summaryWeight', () => {
  it('charges only the overhead for a summary holding no strings', () => {
    expect(summaryWeight(EMPTY_SUMMARY)).toBe(SUMMARY_ENTRY_OVERHEAD)
  })

  it('adds the length of the title', () => {
    expect(summaryWeight({ ...EMPTY_SUMMARY, title: 'abcd' })).toBe(SUMMARY_ENTRY_OVERHEAD + 4)
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
})
