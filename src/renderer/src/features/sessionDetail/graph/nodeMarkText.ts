import type { NodeMarks } from '../../../../../shared/agentGraph/agentGraphNode'
import type { GraphT } from './graphT'

/**
 * The marks as the short strings drawn on a node: `×12` for tool errors, then
 * `▲2` for compactions. A count of zero is left out.
 *
 * @param marks - The node's marks, or `null` when they aren't known.
 * @param t - The graph translate function.
 * @returns The strings, empty when the node has no marks.
 */
export function markLabels(marks: NodeMarks | null, t: GraphT): readonly string[] {
  if (marks === null) return []
  return [
    marks.toolErrors > 0 ? t('graph.node.errorsMark', { count: marks.toolErrors }) : null,
    marks.compactions > 0 ? t('graph.node.compactionsMark', { count: marks.compactions }) : null
  ].filter((label) => label !== null)
}

/**
 * The marks in words, for a node's accessible name, so a screen reader hears
 * "12 tool errors" instead of the glyphs.
 *
 * @param marks - The node's marks, or `null` when they aren't known.
 * @param t - The graph translate function.
 * @returns The phrases, empty when the node has no marks.
 */
export function markFacts(marks: NodeMarks | null, t: GraphT): readonly string[] {
  if (marks === null) return []
  return [
    marks.toolErrors > 0 ? t('graph.node.toolErrors', { count: marks.toolErrors }) : null,
    marks.compactions > 0 ? t('graph.node.compactions', { count: marks.compactions }) : null
  ].filter((fact) => fact !== null)
}
