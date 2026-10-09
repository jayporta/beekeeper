import { RefreshButton } from './RefreshButton'
import { useRefreshLists } from './useRefreshLists'

/** Props for {@link RefreshSessionsButton}. */
interface RefreshSessionsButtonProps {
  /** The folder whose session list to refresh, with the project list. */
  readonly dirName: string
  /** Called each time a press starts a refresh. */
  readonly onRefresh: () => void
}

/**
 * A button that refetches the project list and a folder's session list now.
 * Its state belongs to one folder, so render it with `key={dirName}`.
 *
 * @example
 * <RefreshSessionsButton dirName="-Users-me-repo" onRefresh={() => {}} />
 */
export function RefreshSessionsButton({
  dirName,
  onRefresh
}: RefreshSessionsButtonProps): React.JSX.Element {
  const { refresh, status } = useRefreshLists(dirName)

  return (
    <RefreshButton
      onRefresh={() => {
        onRefresh()
        refresh()
      }}
      status={status}
    />
  )
}
