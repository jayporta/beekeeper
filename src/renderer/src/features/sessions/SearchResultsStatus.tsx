import { useTranslation } from 'react-i18next'

/** Props for {@link SearchResultsStatus}. */
interface SearchResultsStatusProps {
  /** How many sessions match the search, or `null` to announce nothing. */
  readonly count: number | null
}

/**
 * A polite live region that announces the number of matches after a search,
 * for screen readers that can't see the list change (WCAG 4.1.3). It is
 * always rendered and empty until there is a count to announce, so the region
 * exists before its text changes.
 *
 * @example
 * <SearchResultsStatus count={3} />
 */
export function SearchResultsStatus({ count }: SearchResultsStatusProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const message =
    count === null ? '' : count === 0 ? t('search.noMatches') : t('search.matches', { count })

  return (
    <p role="status" className="visuallyHidden">
      {message}
    </p>
  )
}
