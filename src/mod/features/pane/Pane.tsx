import { BrowseScreen } from '../browse/BrowseScreen'
import type { BrowseView } from '../browse/browseView'
import { NavRow } from './NavRow'
import type { PaneElements } from './paneElements'
import type { PaneNav } from './paneNav'
import type { PaneView } from './paneView'
import { SessionScreen, type PaneSelection } from './SessionScreen'

export type { PaneElements } from './paneElements'
export type { PaneSelection } from './SessionScreen'

/** Props of {@link Pane}. */
interface PaneProps {
  /** The engine's elements for the surface being drawn. */
  readonly elements: PaneElements
  /** The view in state, or `undefined` before any refresh. */
  readonly view: PaneView | undefined
  /** The stored selection, or `null` for none. */
  readonly selected: PaneSelection | null
  /** Stores the selection; runs when a row is pressed. */
  readonly onSelect: (key: string) => void | Promise<void>
  /** The stored nav, or `undefined` for the current screen. */
  readonly nav: PaneNav | undefined
  /** The Browse view in state, or `undefined` before Browse has built one. */
  readonly browse: BrowseView | undefined
  /** Stores the nav; runs when a nav button or a session row is pressed. */
  readonly onNav: (nav: PaneNav) => void | Promise<void>
  /** Opens Browse on a project; runs when a project is picked. */
  readonly onPickProject: (dirName: string) => void | Promise<void>
}

/** Whether the stored view is of what the nav shows: the engine's own session, or the browsed one. */
function isViewOf(nav: PaneNav, view: PaneView | undefined): view is PaneView {
  if (view === undefined) return false
  if (nav.screen !== 'session') return view.target === 'current'
  return view.target === 'browsed' && view.sessionId === nav.ref.sessionId
}

/**
 * The pane: a nav row, then the screen the nav names: the Browse screen, or a session's name
 * and token total, its agents as a tree of pressable rows, and the selected agent's changed
 * files. Everything comes from stored views, so drawing never reads a transcript. A view of
 * another session than the nav shows draws as loading.
 *
 * @param props - The elements, the stored views and selection, the nav and the handlers.
 * @returns The tree the `ui.render` hook returns.
 * @example
 * on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) =>
 *   Pane({ elements: $.ui.resolve(e), view, selected, onSelect, nav, browse, onNav, onPickProject })
 * )
 */
export function Pane(props: PaneProps): object {
  const { elements, view, selected, onSelect, browse, onNav, onPickProject } = props
  const { Box } = elements
  const nav: PaneNav = props.nav ?? { screen: 'current' }
  return (
    <Box flexDirection="column">
      {NavRow({ elements, nav, onNav })}
      {nav.screen === 'browse'
        ? BrowseScreen({ elements, browse, nav, onNav, onPickProject })
        : SessionScreen({
            elements,
            view: isViewOf(nav, view) ? view : undefined,
            selected,
            onSelect
          })}
    </Box>
  )
}
