import { useTranslation } from 'react-i18next'
import { MAIN_HEADING_ID } from '@renderer/components/mainHeading'
import { MutedText } from '@renderer/components/MutedText'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { PartialFootnote } from '@renderer/features/sessions/PartialFootnote'
import { figureReasons, type PartialReason } from '@renderer/features/sessions/partialReasons'
import { SeparatedText } from '@renderer/features/sessions/SeparatedText'
import type { SessionLabel } from '@renderer/features/sessions/sessionLabel'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import styles from './SessionDetailHeader.module.css'
import { sessionMetaLine } from './sessionMetaLine'

/** The reasons of a header that shows no figures, so no marker. */
const NO_REASONS: ReadonlySet<PartialReason> = new Set()

/** Props for {@link SessionDetailHeader}. */
interface SessionDetailHeaderProps {
  /** How the session is named, from `sessionDetailLabel`. */
  readonly label: SessionLabel
  /** The session's row in its folder's sessions list, or `null` when the list doesn't hold it. */
  readonly row: SessionRow | null
  /** Whether the session is an archived copy, which the header says. */
  readonly archived: boolean
}

/**
 * The session detail's header: the session's name as the page heading, and a
 * line of its start, duration, team, agents, tokens and cost. A partial figure
 * gets a marker, and a footnote under the line says why. A session the list
 * doesn't hold is named by a placeholder and its short id, with no line. An
 * archived session says its transcript was removed and the copy shown is
 * beekeeper's. The sentence is announced by a status region that is always
 * mounted and empty until then, and shown by text hidden from assistive
 * technology so it isn't read twice.
 *
 * @example
 * <SessionDetailHeader label={label} row={row} archived={false} />
 */
export function SessionDetailHeader({
  label,
  row,
  archived
}: SessionDetailHeaderProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { t: tSessions } = useTranslation('sessions')

  const metaLine = row === null ? [] : sessionMetaLine(row, tSessions)
  // A session with reasons shows figures, so its line is never empty and the marker has a place.
  const reasons = row === null ? NO_REASONS : figureReasons(row)

  return (
    <header className={styles.header}>
      <h1 id={MAIN_HEADING_ID} className={styles.title}>
        <bdi>{label.text}</bdi>
      </h1>
      {label.idHint !== null && <MutedText wrapAnywhere>{label.idHint}</MutedText>}
      {metaLine.length > 0 && (
        <MutedText wrapAnywhere>
          <bdi>
            <SeparatedText parts={metaLine} />
          </bdi>
          {reasons.size > 0 && <PartialMarker note={t('partial.note')} />}
        </MutedText>
      )}
      {/* Mounted before the session turns archived, so filling it is announced. */}
      <p role="status" className="visuallyHidden">
        {archived ? t('archived') : ''}
      </p>
      {archived && <MutedText decorative>{t('archived')}</MutedText>}
      <PartialFootnote
        reasons={reasons}
        overrides={{ missingTeammates: t('partial.missingTeammates') }}
      />
    </header>
  )
}
