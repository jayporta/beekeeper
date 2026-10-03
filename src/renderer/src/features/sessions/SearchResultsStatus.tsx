import { useTranslation } from 'react-i18next'

/** Props for {@link SearchResultsStatus}. */
interface SearchResultsStatusProps {
  /** How many sessions match the search. */
  readonly count: number
  /** Whether a search is active. A blank search announces nothing. */
  readonly searching: boolean
}

/**
 * A polite live region that announces the number of matches after a search,
 * for screen readers that can't see the list change (WCAG 4.1.3). It is
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
  const { t } = useTranslation('sessions')
  const message = !searching
    ? ''
    : count === 0
      ? t('search.noMatches')
      : t('search.matches', { count })

  return (
    <p role="status" className="visuallyHidden">
      {message}
    </p>
  )
}
