import { useTranslation } from 'react-i18next'
import type { MatchCountAnnouncement } from './useMatchCountPerSearch'

/** Props for {@link SearchResultsStatus}. */
interface SearchResultsStatusProps {
  /** The match count to announce, or `null` to announce nothing. */
  readonly announcement: MatchCountAnnouncement | null
}

/**
 * A polite live region that announces the number of matches after a search,
 * for screen readers that can't see the list change (WCAG 4.1.3). It is
 * always rendered and empty until there is a count to announce, so the region
 * exists before its text changes. Each announcement mounts its text afresh,
 * so a count equal to the last one is announced too.
 *
 * @example
 * <SearchResultsStatus announcement={{ count: 3, id: 1 }} />
 */
export function SearchResultsStatus({ announcement }: SearchResultsStatusProps): React.JSX.Element {
  const { t } = useTranslation('sessions')

  return (
    <p role="status" className="visuallyHidden">
      {announcement !== null && (
        <span key={announcement.id}>
          {announcement.count === 0
            ? t('search.noMatches')
            : t('search.matches', { count: announcement.count })}
        </span>
      )}
    </p>
  )
}
