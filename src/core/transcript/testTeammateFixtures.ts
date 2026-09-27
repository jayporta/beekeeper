import { buildUserRecord } from './testFixtures'

interface TeammateSpawnOverrides {
  readonly name?: string
  readonly team?: string
  readonly agentType?: string
  /** The `tool_use_id` on the record's `tool_result` block; `null` leaves the block out. */
  readonly toolUseId?: string | null
  /** Merged onto the built `toolUseResult`, e.g. to override `status` or drop `agent_id`. */
  readonly resultExtra?: Record<string, unknown>
}

/** Builds a `user` record whose `toolUseResult` is a teammate spawn. */
export function buildTeammateSpawnRecord(
  overrides: TeammateSpawnOverrides = {}
): Record<string, unknown> {
  const {
    name = 'scout',
    team = 'team-1',
    agentType = 'Explore',
    toolUseId = 'toolu_spawn',
    resultExtra = {}
  } = overrides
  const content =
    toolUseId === null
      ? 'spawned'
      : [{ type: 'tool_result', tool_use_id: toolUseId, content: 'ok' }]

  return buildUserRecord({
    extra: {
      message: { role: 'user', content },
      toolUseResult: {
        status: 'teammate_spawned',
        agent_id: `${name}@${team}`,
        team_name: team,
        name,
        agent_type: agentType,
        ...resultExtra
      }
    }
  })
}

/** Builds a `user` record whose `toolUseResult` is some other `Agent` outcome, such as `async_launched`. */
export function buildNonTeammateAgentResultRecord(
  status = 'async_launched'
): Record<string, unknown> {
  return buildUserRecord({
    extra: { toolUseResult: { status, agent_id: 'fork-1@team-1', name: 'forked' } }
  })
}

interface TaskStopOverrides {
  /** The `input.task_id`; any value, to build a malformed call. */
  readonly taskId?: unknown
  /** The tool name; a `TaskStop` unless overridden. */
  readonly toolName?: string
  /** The block's `id`, which its result's `tool_use_id` refers back to. */
  readonly toolUseId?: string
  /** Replaces the whole `input`, which may be `undefined` to leave the block without one. */
  readonly input?: unknown
}

/** Builds an `assistant` record holding one `tool_use` block, a `TaskStop` for `taskId` by default. */
export function buildTaskStopRecord(overrides: TaskStopOverrides = {}): Record<string, unknown> {
  const { taskId = 'scout', toolName = 'TaskStop', toolUseId = 'toolu_stop' } = overrides
  const input = 'input' in overrides ? overrides.input : { task_id: taskId }

  return {
    type: 'assistant',
    timestamp: '2026-01-01T00:00:00.000Z',
    message: {
      id: 'msg_stop',
      content: [{ type: 'tool_use', id: toolUseId, name: toolName, input }]
    }
  }
}

/** Builds the `user` record answering a `TaskStop` call, whose `toolUseResult` reports the stopped task's `task_type`. */
export function buildTaskStopResultRecord(
  taskType: string,
  toolUseId = 'toolu_stop'
): Record<string, unknown> {
  return buildUserRecord({
    extra: {
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUseId, content: 'stopped' }]
      },
      toolUseResult: { task_type: taskType }
    }
  })
}
