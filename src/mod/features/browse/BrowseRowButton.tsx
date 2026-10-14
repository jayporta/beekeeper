import { t } from '../../i18n/modI18n'
import { cutLabel, labelRoom } from '../shared/cutLabel'
import type { PaneElements } from '../shared/paneElements'
import type { BrowseRow } from './browseView'

/** The facts about a session as words, most important first, since a long row is cut at its end. */
function facts(row: BrowseRow): string {
  const parts = [
    row.tokens === null ? null : t('row.tokens', { count: row.tokens }),
    row.tokensPartial ? t('row.partial') : null,
    row.lastActiveMs === null ? null : t('browse.lastActive', { value: row.lastActiveMs }),
    row.agents
  ]
  return parts.filter((part) => part !== null).join(t('row.join'))
}

/** Props of {@link BrowseRowButton}. */
interface BrowseRowButtonProps {
  /** The engine's elements for the surface. */
  readonly elements: PaneElements
  /** The session the row shows. */
  readonly row: BrowseRow
  /** Runs when the row is pressed. */
  readonly onOpen: () => void | Promise<void>
  /** The pane's body width in columns, or `undefined` when it is unknown. */
  readonly columns: number | undefined
}

/**
 * One session as a pressable row: the name, cut to a length that leaves room for the facts, then
 * the facts as words. A teammate is indented and marked with a word. The row is cut at the end
 * rather than wrapped.
 *
 * @param props - The elements, the row and the press handler.
 * @returns The row.
 */
export function BrowseRowButton({ elements, row, onOpen, columns }: BrowseRowButtonProps): object {
  const { Button, Text } = elements
  const summary = facts(row)
  const prefix = row.depth === 1 ? `  ${t('row.kind.teammate')}` : ''
  const room = labelRoom({
    columns,
    reserved: prefix.length + (summary === '' ? 0 : 2 + summary.length)
  })
  return (
    <Button key={`browse:${row.key}`} onPress={onOpen}>
      <Text wrap="truncate-end">
        {prefix}
        {cutLabel(row.label, room)}
        {summary === '' ? '' : `  ${summary}`}
      </Text>
    </Button>
  )
}
