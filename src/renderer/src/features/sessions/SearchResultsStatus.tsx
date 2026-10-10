import { useTranslation } from 'react-i18next'
import { useAnnouncementAfterPause } from './useAnnouncementAfterPause'
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
 * exists before its text changes, even when a count is ready as it mounts. A
 * count waits for a pause in typing, and each one mounts its text afresh, so a
 * count equal to the last one is announced too.
 *
 * @example
 * <SearchResultsStatus announcement={{ count: 3, id: 1 }} />
 */
export function SearchResultsStatus({ announcement }: SearchResultsStatusProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const shown = useAnnouncementAfterPause(announcement)

  return (
    <p role="status" className="visuallyHidden">
      {shown !== null && (
        <span key={shown.id}>
          {shown.count === 0 ? t('search.noMatches') : t('search.matches', { count: shown.count })}
        </span>
      )}
    </p>
  )
}
