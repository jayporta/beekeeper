import { describe, expect, it } from 'vitest'
import { createTeammateSpawnObserver } from '../teammateSpawnObserver'
import type { TranscriptTeamSpawns } from '../teammateSpawn'
import { buildUserRecord } from '../testFixtures'
import {
  buildNonTeammateAgentResultRecord,
  buildTaskStopRecord,
  buildTaskStopResultRecord,
  buildTeammateSpawnRecord
} from '../testTeammateFixtures'

/**
 * The observer's own cap on spawns and, separately, stops. Kept here rather
 * than exported from the module. The summary cache's worst-case budget rests
 * on this value, so the tests below fail if the cap moves.
 */
const MAX_TEAMMATE_ENTRIES = 128

function collect(records: readonly Record<string, unknown>[]): TranscriptTeamSpawns {
  const observer = createTeammateSpawnObserver()
  for (const record of records) observer.observe(record)
  return observer.result()
}

describe('createTeammateSpawnObserver', () => {
  it('collects a teammate spawn with its name, team and type', () => {
    expect(collect([buildTeammateSpawnRecord()]).spawns).toEqual([
      { agentName: 'scout', teamName: 'team-1', agentType: 'Explore', toolUseId: 'toolu_spawn' }
    ])
  })

  it('ignores an async_launched result', () => {
    expect(collect([buildNonTeammateAgentResultRecord('async_launched')]).spawns).toEqual([])
  })

  it('ignores a named fork, which arrives as a completed result', () => {
    expect(collect([buildNonTeammateAgentResultRecord('completed')]).spawns).toEqual([])
  })

  it('keeps one spawn for a repeated (team, name) and its first agent type', () => {
    const result = collect([
      buildTeammateSpawnRecord({ agentType: 'Explore' }),
      buildTeammateSpawnRecord({ agentType: 'Plan' })
    ])

    expect(result.spawns).toEqual([
      { agentName: 'scout', teamName: 'team-1', agentType: 'Explore', toolUseId: 'toolu_spawn' }
    ])
  })

  it('keeps the same name spawned into two teams as two spawns', () => {
    const result = collect([
      buildTeammateSpawnRecord({ team: 'team-1' }),
      buildTeammateSpawnRecord({ team: 'team-2' })
    ])

    expect(result.spawns.map((spawn) => spawn.teamName)).toEqual(['team-1', 'team-2'])
  })

  it('keeps spawns in file order', () => {
    const result = collect([
      buildTeammateSpawnRecord({ name: 'b' }),
      buildTeammateSpawnRecord({ name: 'a' })
    ])

    expect(result.spawns.map((spawn) => spawn.agentName)).toEqual(['b', 'a'])
  })

  it('reads team_name in preference to a conflicting agent_id suffix', () => {
    const record = buildTeammateSpawnRecord({
      resultExtra: { agent_id: 'scout@team-1', team_name: 'team-5' }
    })

    expect(collect([record]).spawns[0]?.teamName).toBe('team-5')
  })

  it.each([
    ['missing', undefined],
    ['unusable', 'bad\nteam'],
    ['oversized', 'x'.repeat(300)]
  ])('falls back to the agent_id suffix when team_name is %s', (_case, teamName) => {
    const record = buildTeammateSpawnRecord({ resultExtra: { team_name: teamName } })

    expect(collect([record]).spawns[0]?.teamName).toBe('team-1')
  })

  it('takes the team from after the last @ in agent_id', () => {
    const record = buildTeammateSpawnRecord({
      resultExtra: { agent_id: 'a@b@team-9', team_name: undefined }
    })

    expect(collect([record]).spawns[0]?.teamName).toBe('team-9')
  })

  it('records a null team when agent_id has no @', () => {
    const record = buildTeammateSpawnRecord({
      resultExtra: { agent_id: 'scout', team_name: undefined }
    })

    expect(collect([record]).spawns[0]?.teamName).toBeNull()
  })

  it('collects the tool_use_id of the spawning call', () => {
    const record = buildTeammateSpawnRecord({ toolUseId: 'toolu_abc' })

    expect(collect([record]).spawns[0]?.toolUseId).toBe('toolu_abc')
  })

  it('records a null toolUseId when the id is not a printable label', () => {
    const record = buildTeammateSpawnRecord({ toolUseId: 'toolu\nabc' })

    expect(collect([record]).spawns[0]?.toolUseId).toBeNull()
  })

  it('records a null toolUseId when no tool_result block carries one', () => {
    expect(collect([buildTeammateSpawnRecord({ toolUseId: null })]).spawns[0]?.toolUseId).toBeNull()
  })

  it('records a null agent type when the result has none', () => {
    const record = buildTeammateSpawnRecord({ resultExtra: { agent_type: undefined } })

    expect(collect([record]).spawns[0]?.agentType).toBeNull()
  })

  it('skips a spawn whose name toAgentLabel rejects', () => {
    expect(collect([buildTeammateSpawnRecord({ name: 'bad\nname' })]).spawns).toEqual([])
  })

  it('records a null team for a spawn with neither team_name nor agent_id', () => {
    const record = buildTeammateSpawnRecord({
      resultExtra: { agent_id: undefined, team_name: undefined }
    })

    expect(collect([record]).spawns[0]?.teamName).toBeNull()
  })

  it('ignores a toolUseResult that is not an object', () => {
    const records = ['teammate_spawned', null, [1]].map((toolUseResult) =>
      buildUserRecord({ extra: { toolUseResult } })
    )

    expect(collect(records).spawns).toEqual([])
  })

  it('collects a stop by input.task_id in file order without duplicates', () => {
    const result = collect([
      buildTaskStopRecord({ taskId: 'b' }),
      buildTaskStopRecord({ taskId: 'a' }),
      buildTaskStopRecord({ taskId: 'b' })
    ])

    expect(result.stops).toEqual([
      { agentName: 'b', teamName: null },
      { agentName: 'a', teamName: null }
    ])
  })

  it('pairs a stop with the team of its spawn', () => {
    const result = collect([buildTeammateSpawnRecord({ team: 'team-7' }), buildTaskStopRecord()])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: 'team-7' }])
  })

  it('pairs a stop with the most recent spawn of a name spawned into two teams', () => {
    const result = collect([
      buildTeammateSpawnRecord({ team: 'team-1' }),
      buildTeammateSpawnRecord({ team: 'team-2' }),
      buildTaskStopRecord()
    ])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: 'team-2' }])
  })

  it('pairs a stop with the latest team even when a repeated pair follows another team', () => {
    const result = collect([
      buildTeammateSpawnRecord({ team: 'team-1' }),
      buildTeammateSpawnRecord({ team: 'team-2' }),
      buildTeammateSpawnRecord({ team: 'team-1' }),
      buildTaskStopRecord()
    ])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: 'team-1' }])
  })

  it('records one stop, with its team, for a stop before and after its spawn', () => {
    const result = collect([
      buildTaskStopRecord(),
      buildTeammateSpawnRecord({ team: 'team-3' }),
      buildTaskStopRecord()
    ])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: 'team-3' }])
  })

  it('keeps a spawn whose agent_type is null, with a null agent type', () => {
    const record = buildTeammateSpawnRecord({ resultExtra: { agent_type: null } })

    expect(collect([record]).spawns[0]?.agentType).toBeNull()
  })

  it('excludes a stop whose result reports a local_bash task', () => {
    const result = collect([buildTaskStopRecord(), buildTaskStopResultRecord('local_bash')])

    expect(result.stops).toEqual([])
  })

  it('excludes a stop whose block id is empty, since its result can still match it', () => {
    const result = collect([
      buildTaskStopRecord({ toolUseId: '' }),
      buildTaskStopResultRecord('local_bash', '')
    ])

    expect(result.stops).toEqual([])
  })

  it('keeps a stop whose result reports an in_process_teammate task', () => {
    const result = collect([
      buildTaskStopRecord(),
      buildTaskStopResultRecord('in_process_teammate')
    ])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: null }])
  })

  it('keeps a stop whose result never arrives', () => {
    expect(collect([buildTaskStopRecord()]).stops).toEqual([{ agentName: 'scout', teamName: null }])
  })

  it('matches a stop to its result by tool_use_id', () => {
    const result = collect([
      buildTaskStopRecord({ taskId: 'shell', toolUseId: 'toolu_a' }),
      buildTaskStopRecord({ taskId: 'scout', toolUseId: 'toolu_b' }),
      buildTaskStopResultRecord('in_process_teammate', 'toolu_b'),
      buildTaskStopResultRecord('local_bash', 'toolu_a')
    ])

    expect(result.stops.map((stop) => stop.agentName)).toEqual(['scout'])
  })

  it('splits a name@team task_id into name and team', () => {
    const result = collect([buildTaskStopRecord({ taskId: 'scout@team-9' })])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: 'team-9' }])
  })

  it('prefers the team a task_id states over the team of a spawn', () => {
    const result = collect([
      buildTeammateSpawnRecord({ team: 'team-1' }),
      buildTaskStopRecord({ taskId: 'scout@team-9' })
    ])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: 'team-9' }])
  })

  it('ignores a TaskStop block with no input object', () => {
    expect(collect([buildTaskStopRecord({ input: undefined })]).stops).toEqual([])
  })

  it('keeps a real stop after a local_bash stop that reuses the teammate name', () => {
    const result = collect([
      buildTaskStopRecord({ taskId: 'scout', toolUseId: 'toolu_a' }),
      buildTaskStopResultRecord('local_bash', 'toolu_a'),
      buildTaskStopRecord({ taskId: 'scout', toolUseId: 'toolu_b' }),
      buildTaskStopResultRecord('in_process_teammate', 'toolu_b')
    ])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: null }])
  })

  it('keeps a real bare stop after a local_bash stop of the same bare name', () => {
    const result = collect([
      buildTaskStopRecord({ toolUseId: 'toolu_a' }),
      buildTaskStopResultRecord('local_bash', 'toolu_a'),
      buildTaskStopRecord({ toolUseId: 'toolu_b' }),
      buildTaskStopResultRecord('in_process_teammate', 'toolu_b')
    ])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: null }])
  })

  it('flags truncated when a genuine stop is dropped before an excluding result arrives', () => {
    const others = Array.from({ length: MAX_TEAMMATE_ENTRIES - 1 }, (_, index) =>
      buildTaskStopRecord({ taskId: `other-${index}`, toolUseId: `toolu_${index}` })
    )
    const result = collect([
      buildTaskStopRecord({ toolUseId: 'toolu_bash' }),
      ...others,
      buildTaskStopRecord({ toolUseId: 'toolu_real' }),
      buildTaskStopResultRecord('local_bash', 'toolu_bash')
    ])

    expect([result.stops.some((stop) => stop.agentName === 'scout'), result.truncated]).toEqual([
      false,
      true
    ])
  })

  it('does not resolve a result whose tool_use_id differs only by a trailing space', () => {
    const result = collect([
      buildTaskStopRecord({ toolUseId: 'toolu_a' }),
      buildTaskStopResultRecord('local_bash', 'toolu_a ')
    ])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: null }])
  })

  it('flags truncated when excluded stops fill the cap and a genuine stop is dropped', () => {
    const excluded = Array.from({ length: MAX_TEAMMATE_ENTRIES }, (_, index) => [
      buildTaskStopRecord({ toolUseId: `toolu_${index}` }),
      buildTaskStopResultRecord('local_bash', `toolu_${index}`)
    ]).flat()
    const result = collect([
      ...excluded,
      buildTaskStopRecord({ toolUseId: 'toolu_real' }),
      buildTaskStopResultRecord('in_process_teammate', 'toolu_real')
    ])

    expect([result.stops, result.truncated]).toEqual([[], true])
  })

  it('keeps two stops of one name that state different teams', () => {
    const result = collect([
      buildTaskStopRecord({ taskId: 'scout@team-1' }),
      buildTaskStopRecord({ taskId: 'scout@team-2' })
    ])

    expect(result.stops.map((stop) => stop.teamName)).toEqual(['team-1', 'team-2'])
  })

  it('lists one stop for a name stopped bare and again with its team stated', () => {
    const result = collect([
      buildTeammateSpawnRecord({ team: 'team-1' }),
      buildTaskStopRecord({ taskId: 'scout' }),
      buildTaskStopRecord({ taskId: 'scout@team-1' })
    ])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: 'team-1' }])
  })

  it('ignores a stop result in a record with more than one tool_result block', () => {
    const resultRecord = buildTaskStopResultRecord('local_bash')
    const message = resultRecord.message as { content: unknown[] }
    message.content.push({ type: 'tool_result', tool_use_id: 'toolu_other', content: 'x' })

    expect(collect([buildTaskStopRecord(), resultRecord]).stops).toHaveLength(1)
  })

  it('ignores a task_id longer than a label before splitting it', () => {
    const taskId = `scout@${'x'.repeat(300)}`

    expect(collect([buildTaskStopRecord({ taskId })]).stops).toEqual([])
  })

  it('lists one stop for repeats past the cap and flags truncated, over-reporting rather than risk hiding a drop', () => {
    const records = Array.from({ length: MAX_TEAMMATE_ENTRIES + 5 }, () => buildTaskStopRecord())
    const result = collect(records)

    expect([result.stops.length, result.truncated]).toEqual([1, true])
  })
  it('keeps a stop whose name matches no spawn with a null team', () => {
    const result = collect([
      buildTeammateSpawnRecord({ name: 'a' }),
      buildTaskStopRecord({ taskId: 'other' })
    ])

    expect(result.stops).toEqual([{ agentName: 'other', teamName: null }])
  })

  it('ignores a TaskStop whose task_id is not a usable label', () => {
    expect(
      collect([buildTaskStopRecord({ taskId: 42 }), buildTaskStopRecord({ taskId: '' })]).stops
    ).toEqual([])
  })

  it('ignores a tool_use block that is not TaskStop', () => {
    expect(collect([buildTaskStopRecord({ toolName: 'Bash' })]).stops).toEqual([])
  })

  it('caps spawns and sets truncated', () => {
    const records = Array.from({ length: MAX_TEAMMATE_ENTRIES + 1 }, (_, index) =>
      buildTeammateSpawnRecord({ name: `agent-${index}` })
    )
    const result = collect(records)

    expect([result.spawns.length, result.truncated]).toEqual([MAX_TEAMMATE_ENTRIES, true])
  })

  it('caps stops and sets truncated', () => {
    const records = Array.from({ length: MAX_TEAMMATE_ENTRIES + 1 }, (_, index) =>
      buildTaskStopRecord({ taskId: `agent-${index}` })
    )
    const result = collect(records)

    expect([result.stops.length, result.truncated]).toEqual([MAX_TEAMMATE_ENTRIES, true])
  })

  it('leaves truncated false at exactly the cap', () => {
    const records = Array.from({ length: MAX_TEAMMATE_ENTRIES }, (_, index) =>
      buildTeammateSpawnRecord({ name: `agent-${index}` })
    )

    expect(collect(records).truncated).toBe(false)
  })
})
