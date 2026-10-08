import { describe, expect, it } from 'vitest'
import { buildUserRecord } from '../testFixtures'
import { MAX_TEAMMATE_ENTRIES, collect } from '../testTeammateCollect'
import {
  buildNonTeammateAgentResultRecord,
  buildTeammateSpawnRecord
} from '../testTeammateFixtures'

describe('createTeammateSpawnObserver spawns', () => {
  it('collects a teammate spawn with its name, team and type', () => {
    expect(collect([buildTeammateSpawnRecord()]).spawns).toEqual([
      { agentName: 'scout', teamName: 'team-1', agentType: 'Explore', rawToolUseId: 'toolu_spawn' }
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
      { agentName: 'scout', teamName: 'team-1', agentType: 'Explore', rawToolUseId: 'toolu_spawn' }
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

    expect(collect([record]).spawns[0]?.rawToolUseId).toBe('toolu_abc')
  })

  it('keeps a rawToolUseId verbatim, since it joins a spawn rather than labelling it', () => {
    const record = buildTeammateSpawnRecord({ toolUseId: ' toolu abc ' })

    expect(collect([record]).spawns[0]?.rawToolUseId).toBe(' toolu abc ')
  })

  it('records a null rawToolUseId for an id with an unprintable character', () => {
    const record = buildTeammateSpawnRecord({ toolUseId: 'toolu\nabc' })

    expect(collect([record]).spawns[0]?.rawToolUseId).toBeNull()
  })

  it('records a null rawToolUseId for an empty id', () => {
    expect(
      collect([buildTeammateSpawnRecord({ toolUseId: '' })]).spawns[0]?.rawToolUseId
    ).toBeNull()
  })

  it('records a null rawToolUseId for an id over the block cap', () => {
    const record = buildTeammateSpawnRecord({ toolUseId: 'x'.repeat(257) })

    expect(collect([record]).spawns[0]?.rawToolUseId).toBeNull()
  })

  it('records a null rawToolUseId when no tool_result block carries one', () => {
    expect(
      collect([buildTeammateSpawnRecord({ toolUseId: null })]).spawns[0]?.rawToolUseId
    ).toBeNull()
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

  it('keeps a spawn whose agent_type is null, with a null agent type', () => {
    const record = buildTeammateSpawnRecord({ resultExtra: { agent_type: null } })

    expect(collect([record]).spawns[0]?.agentType).toBeNull()
  })

  it('caps spawns and sets truncated', () => {
    const records = Array.from({ length: MAX_TEAMMATE_ENTRIES + 1 }, (_, index) =>
      buildTeammateSpawnRecord({ name: `agent-${index}` })
    )
    const result = collect(records)

    expect([result.spawns.length, result.truncated]).toEqual([MAX_TEAMMATE_ENTRIES, true])
  })

  it('leaves truncated false at exactly the cap', () => {
    const records = Array.from({ length: MAX_TEAMMATE_ENTRIES }, (_, index) =>
      buildTeammateSpawnRecord({ name: `agent-${index}` })
    )

    expect(collect(records).truncated).toBe(false)
  })
})
