import { toAgentLabel } from './agentLabel'
import { isRecordObject } from './isRecordObject'
import { messageContentBlocks } from './messageContentBlocks'
import { teammateSpawnResultSchema, toolUseBlockSchema } from './schemas'
import { parseSoleToolResultBlock } from './soleToolResultBlock'
import { splitTeamSuffix } from './splitTeamSuffix'
import type { TeammateSpawn, TeammateStop, TranscriptTeamSpawns } from './teammateSpawn'

/** The most spawns and, separately, the most stops kept; real transcripts peak near 63. */
const MAX_TEAMMATE_ENTRIES = 128

/** Collects a transcript's teammate spawns and stops from the records it observes. */
export interface TeammateSpawnObserver {
  /** Feeds one parsed record, in file order. Records that spawn or stop no teammate are ignored. */
  observe(record: Record<string, unknown>): void
  /** What has been collected so far. */
  result(): TranscriptTeamSpawns
}

/** The `TaskStop` `task_type` of a teammate, as its result record reports it. */
const TEAMMATE_TASK_TYPE = 'in_process_teammate'

/**
 * The id of the tool call a record's sole `tool_result` block answers, exactly
 * as written, or `null` when it has none or several. Ids are identifiers, so
 * matching them uses this raw value rather than a cleaned one. A spawn that
 * keeps its id still cleans it, because that copy outlives the scan in the
 * summary cache and so has to be capped and detached like any other value.
 */
function resultToolUseId(record: Record<string, unknown>): string | null {
  const block = parseSoleToolResultBlock(messageContentBlocks(record))
  return block === null ? null : block.tool_use_id
}

/** A `TaskStop` call awaiting the result record that says what it stopped. */
interface StopCandidate {
  readonly agentName: string
  /** The team the `task_id` itself named, or `null` when it had no `@team`. */
  readonly statedTeam: string | null
  /** Set once the result reports a task that is not a teammate. */
  excluded: boolean
}

/**
 * Creates a reducer that collects teammate spawns from `toolUseResult`
 * objects whose `status` is `teammate_spawned`, and stops from `TaskStop`
 * `tool_use` blocks on `assistant` records. Status is the only
 * discriminator: a named `Agent` call may be a fork or a background agent.
 *
 * A spawn without a usable name is skipped, and a repeated (team, name)
 * keeps its first entry, so its `agentType` and `toolUseId` describe the
 * first call. The team is the result's `team_name`, falling back to what
 * follows the last `@` in `agent_id` when `team_name` is absent or unusable.
 * A spawn's `toolUseId` is read from the record's `tool_result` block, only
 * for records that are spawns.
 *
 * One record's `TaskStop` blocks are collected before its own
 * `toolUseResult` is resolved, so a record carrying both still excludes its
 * own stop. Claude Code splits the two across records, but a transcript is
 * free not to.
 *
 * A stop is read from the block's `input.task_id`, not the result's
 * `task_id`, which is an internal id. A `task_id` of the form `name@team`
 * is split at its last `@`, and the team it states wins over an inferred
 * one. Whether a stop targeted a teammate is only known from its result
 * record, which never precedes the block: a result whose `task_type` is present and
 * is not `in_process_teammate` (a shell, a background agent) excludes the
 * stop, matched by the block's `id` to the result's `tool_use_id`. A stop
 * whose result never arrives is kept, since a missing result is not evidence
 * of a shell. Every call is held and the excluded ones are dropped when the
 * result is read, then the survivors are listed once per (team, name) in
 * file order, so a shell stop named like a teammate can't erase the
 * teammate's real stop. A stop's team is its stated team, else the team of
 * the most recent observed spawn of that name, wherever in the file it sits,
 * else `null`, since the spawning transcript may be another one. That is a
 * best guess when a name was reused across teams.
 *
 * Spawns and `TaskStop` calls are each capped at {@link MAX_TEAMMATE_ENTRIES}
 * and `truncated` is set whenever one is dropped for it. A call still
 * occupies cap space after it is excluded, so a crafted transcript can push
 * genuine stops out by filling the cap with excluded ones, but only with
 * `truncated` set. `truncated` can over-report: a dropped call may be a
 * repeat that would have merged away at resolution anyway. No cap drop ever
 * leaves it unset. It says nothing about a call this reducer never accepted,
 * such as a `task_id` over the label cap, which `splitTeamSuffix` refuses
 * whole and which is discarded silently. The name-to-team map is
 * bounded by the same cap, and past it a new name gets no team on its stops;
 * that loses no spawn or stop, so it does not set `truncated`.
 *
 * @returns A reducer ready to `observe` a transcript's records in order.
 */
export function createTeammateSpawnObserver(): TeammateSpawnObserver {
  const spawns: TeammateSpawn[] = []
  const spawnKeys = new Set<string>()
  const latestTeamByName = new Map<string, string | null>()
  const candidates: StopCandidate[] = []
  const pendingById = new Map<string, StopCandidate>()
  let truncated = false

  function addSpawn(record: Record<string, unknown>): void {
    const result = record.toolUseResult
    if (!isRecordObject(result) || result.status !== 'teammate_spawned') return
    const parsed = teammateSpawnResultSchema.safeParse(result)
    if (!parsed.success) return
    const agentName = toAgentLabel(parsed.data.name)
    if (agentName === null) return

    const { agent_id: agentId = '', team_name: explicitTeam } = parsed.data
    const teamName = toAgentLabel(explicitTeam) ?? toAgentLabel(splitTeamSuffix(agentId)?.team)
    if (latestTeamByName.has(agentName) || latestTeamByName.size < MAX_TEAMMATE_ENTRIES) {
      latestTeamByName.set(agentName, teamName)
    }
    const key = `${teamName ?? ''}\0${agentName}`
    if (spawnKeys.has(key)) return
    if (spawns.length >= MAX_TEAMMATE_ENTRIES) {
      truncated = true
      return
    }
    spawnKeys.add(key)
    spawns.push({
      agentName,
      teamName,
      agentType: toAgentLabel(parsed.data.agent_type),
      toolUseId: toAgentLabel(resultToolUseId(record))
    })
  }

  function addStop(block: unknown): void {
    if (!isRecordObject(block) || block.type !== 'tool_use' || block.name !== 'TaskStop') return
    if (!isRecordObject(block.input)) return
    const { task_id: taskId } = block.input
    const split = typeof taskId === 'string' ? splitTeamSuffix(taskId) : null
    const agentName = split === null ? null : toAgentLabel(split.name)
    if (split === null || agentName === null) return

    const statedTeam = toAgentLabel(split.team)
    if (candidates.length >= MAX_TEAMMATE_ENTRIES) {
      truncated = true
      return
    }

    const candidate: StopCandidate = { agentName, statedTeam, excluded: false }
    candidates.push(candidate)
    const parsed = toolUseBlockSchema.safeParse(block)
    if (parsed.success) pendingById.set(parsed.data.id, candidate)
  }

  function resolveStop(record: Record<string, unknown>): void {
    const result = record.toolUseResult
    if (pendingById.size === 0 || !isRecordObject(result)) return
    const { task_type: taskType } = result
    if (typeof taskType !== 'string') return

    const id = resultToolUseId(record)
    if (id === null) return
    const candidate = pendingById.get(id)
    if (candidate === undefined) return
    pendingById.delete(id)
    if (taskType !== TEAMMATE_TASK_TYPE) {
      candidate.excluded = true
    }
  }

  function resolvedStops(): TeammateStop[] {
    const stops = new Map<string, TeammateStop>()
    for (const { agentName, statedTeam, excluded } of candidates) {
      if (excluded) continue
      const teamName = statedTeam ?? latestTeamByName.get(agentName) ?? null
      const key = `${teamName ?? ''}\0${agentName}`
      if (!stops.has(key)) stops.set(key, { agentName, teamName })
    }
    return [...stops.values()]
  }

  return {
    observe(record) {
      if (record.type === 'assistant') {
        for (const block of messageContentBlocks(record)) addStop(block)
      }
      if (record.toolUseResult !== undefined) {
        addSpawn(record)
        resolveStop(record)
      }
    },
    result: () => ({
      spawns: [...spawns],
      stops: resolvedStops(),
      truncated
    })
  }
}
