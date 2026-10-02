import { RefreshButton } from '@renderer/components/RefreshButton'
import { useRefreshLists } from './useRefreshLists'

/** Props for {@link RefreshSessionsButton}. */
interface RefreshSessionsButtonProps {
  /** The folder whose session list to refresh, with the project list. */
  readonly dirName: string
}

/**
 * A button that refetches the project list and a folder's session list now.
 *
 * @example
 * <RefreshSessionsButton dirName="-Users-me-repo" />
 */
export function RefreshSessionsButton({ dirName }: RefreshSessionsButtonProps): React.JSX.Element {
  const { refresh, refreshing, refreshed } = useRefreshLists(dirName)

  return <RefreshButton onRefresh={refresh} refreshing={refreshing} refreshed={refreshed} />
}
