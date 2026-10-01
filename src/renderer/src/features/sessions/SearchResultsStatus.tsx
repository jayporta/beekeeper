/** Props for {@link SearchResultsStatus}. */
interface SearchResultsStatusProps {
  /** How many sessions match the search. */
  readonly count: number
  /** Whether a search is active. A blank search announces nothing. */
  readonly searching: boolean
}

/**
 * A polite live region that announces the number of matches after a search,
 * for screen readers that can't see the table change (WCAG 4.1.3). It is
 * always rendered and empty until a search is active, so the region exists
 * before its text changes.
 *
 * @example
 * <SearchResultsStatus count={3} searching />
 */
export function SearchResultsStatus({
  count,
  searching
}: SearchResultsStatusProps): React.JSX.Element {
  const message = !searching
    ? ''
    : count === 0
      ? 'No matching sessions'
      : `${count} ${count === 1 ? 'session matches' : 'sessions match'}`

  return (
    <p role="status" className="visuallyHidden">
      {message}
    </p>
  )
}
