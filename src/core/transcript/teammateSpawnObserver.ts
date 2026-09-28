import { toAgentLabel } from './agentLabel'
import { isRecordObject } from './isRecordObject'
import { messageContentBlocks } from './messageContentBlocks'
import { teammateSpawnResultSchema, toolUseBlockSchema } from './schemas'
import { parseSoleToolResultBlock } from './soleToolResultBlock'
import { splitTeamSuffix } from './splitTeamSuffix'
import type { TeammateSpawn, TeammateStop, TranscriptTeamSpawns } from './teammateSpawn'

/** The most spawns and, separately, the most stops kept. */
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
 * as written, or `null` when it has none or several.
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
  /**
   * The team the name's latest spawn had when the stop occurred: `null` when
   * that spawn named no team, and `undefined` when no spawn of the name had
   * been seen yet, which is the only case that defers to the end of the file.
   */
  readonly observedTeam: string | null | undefined
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
 * keeps its first entry, so its `agentType` and `rawToolUseId` describe the
 * first call. The team is the result's `team_name`, falling back to what
 * follows the last `@` in `agent_id` when `team_name` is absent or
 * unusable. A spawn's `rawToolUseId` is read from the record's
 * `tool_result` block, only for records that are spawns.
 *
 * A stop is read from a `TaskStop` block's `input.task_id`, split at its
 * last `@` into a name and a stated team. A stop whose result record
 * reports a `task_type` other than `in_process_teammate` (a shell, a
 * background agent) is excluded, and a stop whose result never arrives is
 * kept. Survivors are listed once per (team, name) in file order. A stop's
 * team is its stated team, else the team of the name's latest spawn
 * observed by then, falling back to the name's final team only when no
 * spawn of it was observed at all.
 *
 * Spawns and `TaskStop` calls are each capped at {@link MAX_TEAMMATE_ENTRIES}
 * and `truncated` is set whenever one is dropped for it. A call still
 * occupies cap space once excluded, so a crafted transcript can push
 * genuine stops out by filling the cap with excluded ones, but only with
 * `truncated` set. The name-to-team map is bounded by the same cap, and
 * past it a new name gets no team on its stops; that loses no spawn or
 * stop, so it does not set `truncated`.
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
    const toolUseId = resultToolUseId(record)
    spawns.push({
      agentName,
      teamName,
      agentType: toAgentLabel(parsed.data.agent_type),
      // An empty string is not an identifier, so it joins nothing.
      rawToolUseId: toolUseId === '' ? null : toolUseId
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

    const candidate: StopCandidate = {
      agentName,
      statedTeam,
      observedTeam: latestTeamByName.has(agentName)
        ? (latestTeamByName.get(agentName) ?? null)
        : undefined,
      excluded: false
    }
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
    for (const { agentName, statedTeam, observedTeam, excluded } of candidates) {
      if (excluded) continue
      const observed =
        observedTeam === undefined ? (latestTeamByName.get(agentName) ?? null) : observedTeam
      const teamName = statedTeam ?? observed
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
