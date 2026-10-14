import { t } from '../../i18n/modI18n'
import { errorLine } from './errorLine'
import type { PaneElements } from './paneElements'
import { PaneFiles } from './PaneFiles'
import { PaneRow } from './PaneRow'
import { flattenPaneTree } from './paneTree'
import type { PaneView } from './paneView'

/** What the person selected: the session and the node's key. */
export interface PaneSelection {
  /** The session the selection was made in. */
  readonly sessionId: string
  /** The selected node's key. */
  readonly key: string
}

/** The fixed line for a pane that has no tree, by why it has none. */
function statusLine(view: PaneView | undefined): string {
  if (view?.status === 'waiting') return t('pane.waiting')
  if (view?.status === 'error') return errorLine(view.errorCode)
  return t('pane.loading')
}

/** The totals line: the session's tokens, and a note when they may be short. */
function totalsLine(view: PaneView): string {
  if (view.totalTokens === null) return t('pane.totals.none')
  const total = t('pane.totals.tokens', { count: view.totalTokens })
  return view.totalTokensPartial ? `${total}. ${t('pane.totals.partial')}` : total
}

/** Props of {@link SessionScreen}. */
interface SessionScreenProps {
  /** The engine's elements for the surface being drawn. */
  readonly elements: PaneElements
  /** The view of the session being shown, or `undefined` when there is none yet. */
  readonly view: PaneView | undefined
  /** The stored selection, or `null` for none. */
  readonly selected: PaneSelection | null
  /** Stores the selection; runs when a row is pressed. */
  readonly onSelect: (key: string) => void | Promise<void>
}

/**
 * One session's screen: its name and token total, its agents as a tree of pressable rows,
 * and the selected agent's changed files. Without a tree it says why, in a fixed line.
 *
 * @param props - The elements, the view, the selection and the select handler.
 * @returns The screen.
 */
export function SessionScreen({ elements, view, selected, onSelect }: SessionScreenProps): object {
  const { Box, Text } = elements
  if (view === undefined || view.status !== 'ready' || view.root === null) {
    return (
      <Box flexDirection="column">
        <Text>{t('pane.title')}</Text>
        <Text>{statusLine(view)}</Text>
      </Box>
    )
  }
  const rows = flattenPaneTree(view.root)
  const chosen = selected?.sessionId === view.sessionId ? selected.key : view.root.key
  const current = rows.find(({ node }) => node.key === chosen)?.node ?? view.root
  return (
    <Box flexDirection="column">
      <Text>{t('pane.title')}</Text>
      <Text bold>{view.label ?? ''}</Text>
      <Text>{totalsLine(view)}</Text>
      {rows.map(({ node, depth }) =>
        PaneRow({
          elements,
          node,
          depth,
          isSelected: node.key === current.key,
          onSelect: () => onSelect(node.key)
        })
      )}
      {PaneFiles({ elements, node: current })}
    </Box>
  )
}
