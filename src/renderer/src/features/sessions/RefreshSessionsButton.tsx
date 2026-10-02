import { RefreshButton } from '@renderer/components/RefreshButton'
import { useRefreshLists } from './useRefreshLists'

/** Props for {@link RefreshSessionsButton}. */
interface RefreshSessionsButtonProps {
  /** The folder whose session list to refresh, with the project list. */
  readonly dirName: string
}

/**
 * A button that refetches the project list and a folder's session list now.
 * Its state belongs to one folder, so render it with `key={dirName}`.
 *
 * @example
 * <RefreshSessionsButton dirName="-Users-me-repo" />
 */
export function RefreshSessionsButton({ dirName }: RefreshSessionsButtonProps): React.JSX.Element {
  const { refresh, status } = useRefreshLists(dirName)

  return <RefreshButton onRefresh={refresh} status={status} />
}
