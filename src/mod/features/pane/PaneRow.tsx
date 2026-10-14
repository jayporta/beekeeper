import { t } from '../../i18n/modI18n'
import { cutLabel, labelRoom } from '../shared/cutLabel'
import type { PaneElements } from '../shared/paneElements'
import type { PaneNode } from './paneView'

/** The deepest level that still indents, so a deep tree keeps room for names. */
const MAX_INDENT_LEVELS = 6

/** The facts about an agent as words, most important first, since a long row is cut at its end. */
function facts(node: PaneNode): string {
  const parts = [
    node.stopped ? t('row.stopped') : null,
    node.partial ? t('row.partial') : null,
    node.toolErrors ? t('row.toolErrors', { count: node.toolErrors }) : null,
    node.compactions ? t('row.compactions', { count: node.compactions }) : null,
    node.tokens === null ? null : t('row.tokens', { count: node.tokens })
  ]
  return parts.filter((part) => part !== null).join(t('row.join'))
}

/** The word that says what a row is, for the kinds the name alone doesn't tell. The lead's name is already "Lead". */
function kindWord(kind: string): string {
  if (kind === 'teammate') return t('row.kind.teammate')
  if (kind === 'workflow') return t('row.kind.workflow')
  return ''
}

/** Props of {@link PaneRow}. */
interface PaneRowProps {
  /** The engine's elements for the surface. */
  readonly elements: PaneElements
  /** The node the row shows. */
  readonly node: PaneNode
  /** How deep the node sits. */
  readonly depth: number
  /** Whether the node is the selected one, which a word shows rather than a color. */
  readonly isSelected: boolean
  /** Runs when the row is pressed. */
  readonly onSelect: () => void | Promise<void>
  /** The pane's body width in columns, or `undefined` when it is unknown. */
  readonly columns: number | undefined
}

/**
 * One agent as a pressable row: the indent, the word "Selected" for the selected row,
 * what a teammate or workflow run is,  the name cut to the pane's width, then the facts as words (stopped,
 * incomplete, tool errors, compactions, tokens) and the type dimmed. The row is cut at
 * the end rather than wrapped, so what matters most comes first.
 *
 * @param props - The elements, node, depth, selection and press handler.
 * @returns The row.
 */
export function PaneRow(props: PaneRowProps): object {
  const { elements, node, depth, isSelected, onSelect, columns } = props
  const { Button, Text } = elements
  const indent = ' '.repeat(2 * Math.min(depth, MAX_INDENT_LEVELS))
  const summary = facts(node)
  const prefix = `${indent}${t(isSelected ? 'row.selected' : 'row.unselected')}${kindWord(node.kind)}`
  const room = labelRoom({
    columns,
    reserved:
      prefix.length + (summary === '' ? 0 : 2 + summary.length) + (node.agentType?.length ?? 0) + 2
  })
  return (
    <Button key={node.key} onPress={onSelect}>
      <Text wrap="truncate-end">
        {prefix}
        {cutLabel(node.name, room)}
        {summary === '' ? '' : `  ${summary}`}
        {node.agentType === null ? (
          ''
        ) : (
          <Text dimColor>
            {summary === '' ? '  ' : t('row.join')}
            {node.agentType}
          </Text>
        )}
      </Text>
    </Button>
  )
}
