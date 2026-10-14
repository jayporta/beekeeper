import { t } from '../../i18n/modI18n'
import { errorLine } from '../pane/errorLine'
import type { PaneElements } from '../pane/paneElements'
import type { PaneNav } from '../pane/paneNav'
import type { BrowseRow, BrowseView } from './browseView'
import { BrowseRowButton } from './BrowseRowButton'
import { ProjectPicker } from './ProjectPicker'

/** Props of {@link BrowseScreen}. */
interface BrowseScreenProps {
  /** The engine's elements for the surface. */
  readonly elements: PaneElements
  /** The Browse view in state, or `undefined` before one is built. */
  readonly browse: BrowseView | undefined
  /** The nav, on its Browse screen. */
  readonly nav: Extract<PaneNav, { screen: 'browse' }>
  /** Stores the nav; runs when a session row is pressed. */
  readonly onNav: (nav: PaneNav) => void | Promise<void>
  /** Opens Browse on a project; runs when one is picked. */
  readonly onPickProject: (dirName: string) => void | Promise<void>
}

/** Whether the stored view is the one the nav asks for: a view of another project than the one the nav names is stale. */
function isCurrent(browse: BrowseView | undefined, nav: BrowseScreenProps['nav']): boolean {
  if (browse === undefined || browse.status === 'loading') return false
  return nav.projectDirName === null || nav.projectDirName === browse.projectDirName
}

/**
 * The Browse screen: a project picker, the picked project's sessions as pressable rows, and a
 * line saying how many more there are than the cap shows. Without a view for the project asked
 * for it says it is loading, and a failed list keeps the picker so another project can be picked.
 *
 * @param props - The elements, the Browse view, the nav and the handlers.
 * @returns The screen.
 */
export function BrowseScreen({
  elements,
  browse,
  nav,
  onNav,
  onPickProject
}: BrowseScreenProps): object {
  const { Box, Text } = elements
  const openSession = (row: BrowseRow): void | Promise<void> =>
    onNav({
      screen: 'session',
      ref: row.ref,
      backTo: browse?.projectDirName ?? row.ref.projectDirName
    })
  if (browse === undefined || !isCurrent(browse, nav)) {
    return (
      <Box flexDirection="column">
        <Text>{t('browse.loading')}</Text>
      </Box>
    )
  }
  if (browse.projects.length === 0 && browse.projectDirName === null && browse.status === 'ready') {
    return (
      <Box flexDirection="column">
        <Text>{t('browse.noProjects')}</Text>
      </Box>
    )
  }
  return (
    <Box flexDirection="column">
      {browse.projects.length > 0
        ? ProjectPicker({
            elements,
            projects: browse.projects,
            projectDirName: browse.projectDirName,
            onPick: onPickProject
          })
        : null}
      {browse.status === 'error' ? <Text>{errorLine(browse.errorCode)}</Text> : null}
      {browse.status === 'ready' && browse.rows.length === 0 ? (
        <Text>{t('browse.noSessions')}</Text>
      ) : null}
      {browse.rows.map((row) =>
        BrowseRowButton({
          elements,
          row,
          onOpen: () => openSession(row)
        })
      )}
      {browse.hiddenCount > 0 ? (
        <Text>{t('browse.more', { count: browse.hiddenCount })}</Text>
      ) : null}
    </Box>
  )
}
