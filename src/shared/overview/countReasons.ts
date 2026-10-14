import type { ProjectTotalsPartialDto } from '../ipc/projectTotalsDto'

/** Why a sum of sessions may be low, for each reason a session count can give. The order is the order a footnote gives them in. */
export const COUNT_REASONS = [
  'unreadable',
  'withoutTokens',
  'withoutCost',
  'lowTokens',
  'uncountedSubagents',
  'undated'
] as const

/** One reason a sum of sessions may be low. */
export type CountReason = (typeof COUNT_REASONS)[number]

/** A figure of a sum that a partial count can leave low. */
export type PartialFigure = 'tokens' | 'cost' | 'sessions' | 'agents'

/** Every figure of a sum, for a reason that leaves all of them low. */
export const ALL_FIGURES = [
  'tokens',
  'cost',
  'sessions',
  'agents'
] as const satisfies readonly PartialFigure[]

/**
 * The figures each reason leaves low. An unreadable session, and a session
 * that is dated by its file's write time (so may belong outside the window),
 * touch every figure. A session whose subagents folder couldn't be read
 * touches only the agent count: a recorded token total already includes its
 * subagents, and the transcript fallback that doesn't is counted as
 * `lowTokens`. The rest touch the one figure they name.
 */
export const FIGURES_AFFECTED_BY_COUNT: Readonly<Record<CountReason, readonly PartialFigure[]>> = {
  unreadable: ALL_FIGURES,
  withoutTokens: ['tokens'],
  withoutCost: ['cost'],
  lowTokens: ['tokens'],
  uncountedSubagents: ['agents'],
  undated: ALL_FIGURES
}

/**
 * Names the reasons a sum of sessions is partial from its counts.
 *
 * @param partial - How many sessions leave the sum incomplete, by reason.
 * @returns The reasons whose count is above zero, in footnote order.
 */
export function countReasonsOf(partial: ProjectTotalsPartialDto): readonly CountReason[] {
  return COUNT_REASONS.filter((reason) => partial[reason] > 0)
}

/**
 * Works out which figures a set of reasons leaves low.
 *
 * @param reasons - The reasons that apply.
 * @param affected - The figures each reason leaves low.
 * @returns For each figure, `true` when a reason leaves it low.
 */
export function figuresMarkedBy<Reason extends string>(
  reasons: readonly Reason[],
  affected: Readonly<Record<Reason, readonly PartialFigure[]>>
): Readonly<Record<PartialFigure, boolean>> {
  const marks = (figure: PartialFigure): boolean =>
    reasons.some((reason) => affected[reason].includes(figure))
  return {
    tokens: marks('tokens'),
    cost: marks('cost'),
    sessions: marks('sessions'),
    agents: marks('agents')
  }
}
