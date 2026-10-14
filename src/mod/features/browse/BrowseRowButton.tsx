import { t } from '../../i18n/modI18n'
import type { PaneElements } from '../pane/paneElements'
import type { BrowseRow } from './browseView'
import { cutLabel } from './cutLabel'

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
}

/**
 * One session as a pressable row: the name, cut to a length that leaves room for the facts, then
 * the facts as words. A teammate is indented and marked with a word. The row is cut at the end
 * rather than wrapped.
 *
 * @param props - The elements, the row and the press handler.
 * @returns The row.
 */
export function BrowseRowButton({ elements, row, onOpen }: BrowseRowButtonProps): object {
  const { Button, Text } = elements
  const summary = facts(row)
  return (
    <Button key={`browse:${row.key}`} onPress={onOpen}>
      <Text wrap="truncate-end">
        {row.depth === 1 ? `  ${t('row.kind.teammate')}` : ''}
        {cutLabel(row.label)}
        {summary === '' ? '' : `  ${summary}`}
      </Text>
    </Button>
  )
}
