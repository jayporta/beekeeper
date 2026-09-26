import { describe, expect, it } from 'vitest'
import { collect } from '../testTeammateCollect'
import {
  buildTaskStopRecord,
  buildTaskStopResultRecord,
  buildTeammateSpawnRecord
} from '../testTeammateFixtures'

describe('createTeammateSpawnObserver stops', () => {
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

  it('excludes a stop whose own record also carries the non-teammate result', () => {
    const stop = buildTaskStopRecord()
    const record = {
      ...stop,
      toolUseResult: { task_type: 'local_bash' },
      message: {
        id: 'msg_both',
        content: [
          ...(stop.message as { content: readonly unknown[] }).content,
          { type: 'tool_result', tool_use_id: 'toolu_stop', content: 'stopped' }
        ]
      }
    }

    expect(collect([record]).stops).toEqual([])
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

  it('does not resolve a result whose tool_use_id differs only by a trailing space', () => {
    const result = collect([
      buildTaskStopRecord({ toolUseId: 'toolu_a' }),
      buildTaskStopResultRecord('local_bash', 'toolu_a ')
    ])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: null }])
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

  it('keeps a stop under the team its spawn had when the name is later spawned into another team', () => {
    const result = collect([
      buildTeammateSpawnRecord({ team: 'team-a' }),
      buildTaskStopRecord(),
      buildTeammateSpawnRecord({ team: 'team-b' })
    ])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: 'team-a' }])
  })

  it('keeps a stop team-less when its spawn named no team, whatever a later spawn names', () => {
    const result = collect([
      buildTeammateSpawnRecord({ resultExtra: { team_name: undefined, agent_id: 'scout' } }),
      buildTaskStopRecord(),
      buildTeammateSpawnRecord({ team: 'team-b' })
    ])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: null }])
  })

  it('resolves a stop that precedes its spawn to the spawn team', () => {
    const result = collect([buildTaskStopRecord(), buildTeammateSpawnRecord({ team: 'team-3' })])

    expect(result.stops).toEqual([{ agentName: 'scout', teamName: 'team-3' }])
  })
})
