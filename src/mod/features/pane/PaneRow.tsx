import { t } from '../../i18n/modI18n'
import type { PaneElements } from './paneElements'
import type { PaneNode } from './paneView'

/** The deepest level that still indents, so a deep tree keeps room for names. */
const MAX_INDENT_LEVELS = 6

/** The agent's tokens and marks as words, such as `1 token, 3 tool errors, stopped`. */
function details(node: PaneNode): string {
  const parts = [
    node.tokens === null ? null : t('row.tokens', { count: node.tokens }),
    node.toolErrors ? t('row.toolErrors', { count: node.toolErrors }) : null,
    node.compactions ? t('row.compactions', { count: node.compactions }) : null,
    node.stopped ? t('row.stopped') : null,
    node.partial ? t('row.partial') : null
  ]
  return parts.filter((part) => part !== null).join(t('row.join'))
}

/** Props of {@link PaneRow}. */
interface PaneRowProps {
  /** The engine's elements for the surface. */
  readonly elements: PaneElements
  /** The node the row shows. */
  readonly node: PaneNode
  /** How deep the node sits. */
  readonly depth: number
  /** Whether the node is the selected one, which a marker shows besides any color. */
  readonly isSelected: boolean
  /** Runs when the row is pressed. */
  readonly onSelect: () => void | Promise<void>
}

/**
 * One agent as a pressable row: a marker for the selection, the indent, the
 * name, its type dimmed, then its tokens and marks as words. The row is cut at
 * the edge rather than wrapped.
 *
 * @param props - The elements, node, depth, selection and press handler.
 * @returns The row.
 */
export function PaneRow(props: PaneRowProps): object {
  const { elements, node, depth, isSelected, onSelect } = props
  const { Button, Text } = elements
  const indent = ' '.repeat(2 * Math.min(depth, MAX_INDENT_LEVELS))
  const facts = details(node)
  return (
    <Button key={node.key} onPress={onSelect}>
      <Text wrap="truncate-end">
        {t(isSelected ? 'row.selected' : 'row.unselected')}
        {indent}
        {node.name}
        {node.agentType === null ? '' : <Text dimColor> {node.agentType}</Text>}
        {facts === '' ? '' : `  ${facts}`}
      </Text>
    </Button>
  )
}
