import { t } from '../../i18n/modI18n'
import type { PaneElements } from '../shared/paneElements'
import type { PaneNav } from '../shared/paneNav'

/** Props of {@link NavRow}. */
interface NavRowProps {
  /** The engine's elements for the surface. */
  readonly elements: PaneElements
  /** Which screen shows. */
  readonly nav: PaneNav
  /** Stores the nav; runs when a button is pressed. */
  readonly onNav: (nav: PaneNav) => void | Promise<void>
}

/** The project Browse returns to: the one a browsed session was opened from, or the one picked, else none yet. */
function browseProject(nav: PaneNav): string | null {
  if (nav.screen === 'session') return nav.backTo
  return nav.screen === 'browse' ? nav.projectDirName : null
}

/** The name of the Browse button: marked as showing on Browse, and on a browsed session saying that it leaves the session. */
function browseName(nav: PaneNav, browse: string): string {
  if (nav.screen === 'browse') return t('nav.showing', { name: browse })
  return nav.screen === 'session' ? t('nav.browseFromSession') : browse
}

/**
 * The row that leads every screen: `This session` and `Browse`, a word marking the one showing
 * rather than a color. On a browsed session `Browse` says it goes back to the session list, and returns to the project the session was opened from.
 *
 * @param props - The elements, the nav and the handler.
 * @returns The row.
 */
export function NavRow({ elements, nav, onNav }: NavRowProps): object {
  const { Box, Button, Text } = elements
  const current = t('nav.current')
  const browse = t('nav.browse')
  const toCurrent = (): void | Promise<void> => onNav({ screen: 'current' })
  const toBrowse = (): void | Promise<void> =>
    onNav({ screen: 'browse', projectDirName: browseProject(nav) })
  return (
    <Box flexDirection="row">
      <Button key="nav-current" onPress={toCurrent}>
        <Text>{nav.screen === 'current' ? t('nav.showing', { name: current }) : current}</Text>
      </Button>
      <Button key="nav-browse" onPress={toBrowse}>
        <Text>{browseName(nav, browse)}</Text>
      </Button>
    </Box>
  )
}
