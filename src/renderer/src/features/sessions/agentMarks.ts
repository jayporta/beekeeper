import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { agentCounts } from './agentCounts'

/** What a mark in a card's agent strip stands for. */
export type AgentMarkKind = 'lead' | 'teammate' | 'workflow' | 'subagent'

/** The marks of a card's agent strip. */
export interface AgentMarks {
  /** The marks to draw, in order, at most {@link AGENT_MARK_LIMIT}. */
  readonly marks: readonly AgentMarkKind[]
  /** How many more marks there would be than the limit allows. */
  readonly overflow: number
}

/** The most marks a card's agent strip draws. */
export const AGENT_MARK_LIMIT = 12

/**
 * Lays out a card's agent strip: one mark for the session itself, then one
 * per teammate grouped under a lead, then one per workflow run, then one per
 * plain subagent, capped at {@link AGENT_MARK_LIMIT}. The runs come before the
 * subagents so a session with many subagents still shows its runs. The session's own mark is a teammate mark when it
 * is itself a teammate agent, otherwise a lead mark. A session whose summary
 * couldn't be read still has its one mark.
 *
 * @param item - A session list item.
 * @returns The marks and how many marks the limit leaves out.
 */
export function agentMarks(item: SessionListItemDto): AgentMarks {
  const isTeammate =
    item.team?.kind === 'teammate' ||
    item.team?.kind === 'ungrouped' ||
    (item.summary.ok && item.summary.value.role.kind === 'agent')
  const { teammates, subagents, workflowRuns } = agentCounts(item)
  const runs: readonly (readonly [AgentMarkKind, number])[] = [
    [isTeammate ? 'teammate' : 'lead', 1],
    ['teammate', teammates],
    ['workflow', workflowRuns],
    ['subagent', subagents]
  ]

  const marks: AgentMarkKind[] = []
  let total = 0
  for (const [kind, count] of runs) {
    total += count
    const room = AGENT_MARK_LIMIT - marks.length
    for (let drawn = 0; drawn < Math.min(count, room); drawn += 1) marks.push(kind)
  }
  return { marks, overflow: total - marks.length }
}
