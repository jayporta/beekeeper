import type { PaneView } from './paneView'

/** Whether the session has teammates or is one, so listing the folder's sessions can change what the pane shows. */
export function hasTeam(view: PaneView | null): boolean {
  const root = view?.root
  if (root === null || root === undefined) return false
  return root.kind === 'teammate' || root.children.some((child) => child.key.startsWith('mate:'))
}
