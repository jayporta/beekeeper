import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildAgentSettingRecord,
  buildAiTitleRecord,
  buildAssistantRecord,
  buildCostStateRecord,
  buildJsonlText,
  buildJsonlTextWithPartialLastLine,
  buildUserRecord
} from '../../testFixtures'
import { buildTaskStopRecord, buildTeammateSpawnRecord } from '../../testTeammateFixtures'
import { scanSessionSummary } from '../scanSessionSummary'
import { createTranscriptDir, type TranscriptDir } from '../testTranscriptDir'

let dir: TranscriptDir

beforeEach(() => {
  dir = createTranscriptDir()
})

afterEach(() => {
  dir.cleanup()
})

/** Writes a session transcript and returns its path. */
function writeTranscript(content: string): string {
  return dir.write('session.jsonl', content).path
}

describe('scanSessionSummary', () => {
  it('takes the last ai-title in the file, since a session retitles itself as it runs', async () => {
    const filePath = writeTranscript(
      buildJsonlText([
        buildAiTitleRecord('First guess at the task'),
        buildAssistantRecord(),
        buildAiTitleRecord('What the task turned out to be')
      ])
    )

    const summary = await scanSessionSummary(filePath)

    expect(summary.title).toBe('What the task turned out to be')
  })

  it('keeps the last valid cost-state when a later cost-state record is malformed', async () => {
    const filePath = writeTranscript(
      buildJsonlText([
        buildCostStateRecord({ totalCostUSD: 1.5 }),
        { type: 'cost-state', totalCostUSD: 'free' }
      ])
    )

    const summary = await scanSessionSummary(filePath)

    expect(summary.cost).toEqual({ totalUSD: 1.5 })
  })

  it('keeps the last valid title when a later ai-title record is malformed', async () => {
    const filePath = writeTranscript(
      buildJsonlText([buildAiTitleRecord('A real title'), { type: 'ai-title' }])
    )

    const summary = await scanSessionSummary(filePath)

    expect(summary.title).toBe('A real title')
  })

  it('reports no title when the session never wrote one', async () => {
    const filePath = writeTranscript(buildJsonlText([buildAssistantRecord()]))

    const summary = await scanSessionSummary(filePath)

    expect(summary.title).toBeNull()
  })

  it('takes the last cost-state, since the records are cumulative', async () => {
    const filePath = writeTranscript(
      buildJsonlText([
        buildCostStateRecord({ totalCostUSD: 0.5 }),
        buildCostStateRecord({ totalCostUSD: 2.75 })
      ])
    )

    const summary = await scanSessionSummary(filePath)

    expect(summary.cost?.totalUSD).toBe(2.75)
  })

  it('reports no cost-state, rather than a zero cost, for a session that never wrote one', async () => {
    const filePath = writeTranscript(buildJsonlText([buildAssistantRecord()]))

    const summary = await scanSessionSummary(filePath)

    expect(summary.cost).toBeNull()
  })

  it('records a cost-state that carries no total as a recorded cost with no total', async () => {
    const filePath = writeTranscript(
      buildJsonlText([buildCostStateRecord({ totalCostUSD: undefined })])
    )

    const summary = await scanSessionSummary(filePath)

    expect(summary.cost).toEqual({ totalUSD: null })
  })

  it('caps a title far longer than one worth displaying', async () => {
    const filePath = writeTranscript(buildJsonlText([buildAiTitleRecord('a'.repeat(5000))]))

    const summary = await scanSessionSummary(filePath)

    expect(summary.title).toBe('a'.repeat(200))
  })

  it('caps a title without leaving half of a surrogate pair behind', async () => {
    // One leading 'a' puts the cut inside a pair rather than between two.
    const filePath = writeTranscript(
      buildJsonlText([buildAiTitleRecord(`a${'\u{1F41D}'.repeat(300)}`)])
    )

    const summary = await scanSessionSummary(filePath)

    expect(summary.title).toBe(`a${'\u{1F41D}'.repeat(99)}`)
  })

  it('spans the smallest and largest timestamps, not the first and last lines', async () => {
    const filePath = writeTranscript(
      buildJsonlText([
        buildAssistantRecord({ timestamp: '2026-01-01T00:05:00.000Z' }),
        buildAssistantRecord({ timestamp: '2026-01-01T00:09:00.000Z' }),
        buildAssistantRecord({ timestamp: '2026-01-01T00:01:00.000Z' })
      ])
    )

    const summary = await scanSessionSummary(filePath)

    expect(summary.activity).toEqual({
      earliestMs: Date.parse('2026-01-01T00:01:00.000Z'),
      latestMs: Date.parse('2026-01-01T00:09:00.000Z')
    })
  })

  it('ignores a timestamp nested inside a record', async () => {
    const filePath = writeTranscript(
      buildJsonlText([
        buildAssistantRecord({ timestamp: '2026-01-01T00:05:00.000Z' }),
        { type: 'file-history-snapshot', snapshot: { timestamp: '1999-01-01T00:00:00.000Z' } }
      ])
    )

    const summary = await scanSessionSummary(filePath)

    expect(summary.activity?.earliestMs).toBe(Date.parse('2026-01-01T00:05:00.000Z'))
  })

  it('reports no activity when no record carries a timestamp', async () => {
    const filePath = writeTranscript(buildJsonlText([buildAiTitleRecord(), buildCostStateRecord()]))

    const summary = await scanSessionSummary(filePath)

    expect(summary.activity).toBeNull()
  })

  it('summarizes an empty file as an empty session', async () => {
    const filePath = writeTranscript('')

    const summary = await scanSessionSummary(filePath)

    expect(summary).toEqual({
      title: null,
      cost: null,
      activity: null,
      skippedLines: 0,
      role: { kind: 'lead' },
      teamSpawns: { spawns: [], stops: [], truncated: false }
    })
  })

  it('summarizes a subagent transcript, which carries no title and no cost-state', async () => {
    const filePath = writeTranscript(
      buildJsonlText([
        { type: 'fork-context-ref', parentSessionId: 's1', parentLastUuid: 'u1', contextLength: 8 },
        buildAssistantRecord({ timestamp: '2026-01-01T00:02:00.000Z' })
      ])
    )

    const summary = await scanSessionSummary(filePath)

    expect(summary).toEqual({
      title: null,
      cost: null,
      activity: {
        earliestMs: Date.parse('2026-01-01T00:02:00.000Z'),
        latestMs: Date.parse('2026-01-01T00:02:00.000Z')
      },
      skippedLines: 0,
      role: { kind: 'lead' },
      teamSpawns: { spawns: [], stops: [], truncated: false }
    })
  })

  it('counts a line that is not valid JSON and keeps scanning', async () => {
    const filePath = writeTranscript(
      `${JSON.stringify(buildAiTitleRecord('Survived'))}\n{"type":"assist\n`
    )

    const summary = await scanSessionSummary(filePath)

    expect(summary).toMatchObject({ title: 'Survived', skippedLines: 1 })
  })

  it('counts a line that is valid JSON but not a record object', async () => {
    const filePath = writeTranscript(buildJsonlText([null, [buildAiTitleRecord()], 7]))

    const summary = await scanSessionSummary(filePath)

    expect(summary).toMatchObject({ title: null, skippedLines: 3 })
  })

  it('counts a line too long to buffer', async () => {
    const filePath = writeTranscript(
      buildJsonlText([
        buildAiTitleRecord('Short enough'),
        { type: 'user', padding: 'x'.repeat(200) }
      ])
    )

    const summary = await scanSessionSummary(filePath, { maxLineChars: 128 })

    expect(summary).toMatchObject({ title: 'Short enough', skippedLines: 1 })
  })

  it('does not count the unterminated last line of a session still being written', async () => {
    const filePath = writeTranscript(
      buildJsonlTextWithPartialLastLine([buildAiTitleRecord('Still running')], '{"type":"assist')
    )

    const summary = await scanSessionSummary(filePath)

    expect(summary).toMatchObject({ title: 'Still running', skippedLines: 0 })
  })

  it('rejects a transcript that does not exist', async () => {
    await expect(scanSessionSummary(join(dir.root, 'missing.jsonl'))).rejects.toThrow()
  })

  describe('role', () => {
    it('reads a transcript with no agent markers as a lead', async () => {
      const filePath = writeTranscript(buildJsonlText([buildUserRecord(), buildAssistantRecord()]))

      expect((await scanSessionSummary(filePath)).role).toEqual({ kind: 'lead' })
    })

    it('reads an empty file as a lead', async () => {
      expect((await scanSessionSummary(writeTranscript(''))).role).toEqual({ kind: 'lead' })
    })

    it('reads an agent session with its type, name, and team', async () => {
      const filePath = writeTranscript(
        buildJsonlText([
          buildAgentSettingRecord('Explore'),
          buildUserRecord({ extra: { agentName: 'scout', teamName: 'team-1' } })
        ])
      )

      expect((await scanSessionSummary(filePath)).role).toEqual({
        kind: 'agent',
        agentType: 'Explore',
        agentName: 'scout',
        teamName: 'team-1'
      })
    })

    it('reads an agent session with no teamName as having a null team', async () => {
      const filePath = writeTranscript(
        buildJsonlText([
          buildAgentSettingRecord('Explore'),
          buildUserRecord({ extra: { agentName: 'scout' } })
        ])
      )

      expect((await scanSessionSummary(filePath)).role).toMatchObject({
        kind: 'agent',
        teamName: null
      })
    })

    it('classifies an agent session whose first line is unparseable and still counts the line', async () => {
      const filePath = writeTranscript(
        'not json\n' + buildJsonlText([buildAgentSettingRecord('Explore')])
      )

      const summary = await scanSessionSummary(filePath)

      expect([summary.role.kind, summary.skippedLines]).toEqual(['agent', 1])
    })
  })

  describe('team spawns', () => {
    it('returns empty lists for a transcript that spawned no teammate', async () => {
      const filePath = writeTranscript(buildJsonlText([buildUserRecord(), buildAssistantRecord()]))

      expect((await scanSessionSummary(filePath)).teamSpawns).toEqual({
        spawns: [],
        stops: [],
        truncated: false
      })
    })

    it('collects a spawn and a stop from one pass', async () => {
      const filePath = writeTranscript(
        buildJsonlText([buildTeammateSpawnRecord(), buildTaskStopRecord({ taskId: 'scout' })])
      )

      expect((await scanSessionSummary(filePath)).teamSpawns).toEqual({
        spawns: [
          {
            agentName: 'scout',
            teamName: 'team-1',
            agentType: 'Explore',
            rawToolUseId: 'toolu_spawn'
          }
        ],
        stops: [{ agentName: 'scout', teamName: 'team-1' }],
        truncated: false
      })
    })
  })
})
