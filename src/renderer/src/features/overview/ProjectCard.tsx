import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { CardOpenButton } from '@renderer/components/CardOpenButton'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import type { ProjectGroup } from '@renderer/features/projects/groupProjects'
import { projectTitle } from '@renderer/features/projects/projectTitle'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { formatUsd } from '@renderer/i18n/formatUsd'
import { FigurePlaceholder } from './FigurePlaceholder'
import styles from './ProjectCard.module.css'
import { OVERVIEW_FOOTNOTE_ID } from './overviewFootnoteId'
import { partialFiguresOf, partialReasonsOf } from './partialReasons'
import { totalsStatus, type AggregateTotals } from './sumTotals'

/** Marks the start of text whose direction is its own, so it doesn't reorder the text around it. */
const FIRST_STRONG_ISOLATE = '\u2068'
/** Ends the text {@link FIRST_STRONG_ISOLATE} began. */
const POP_DIRECTIONAL_ISOLATE = '\u2069'

/** Props for {@link ProjectCard}. */
interface ProjectCardProps {
  /** The project and its worktrees. */
  readonly group: ProjectGroup
  /** What the project and its worktrees add up to. */
  readonly totals: AggregateTotals
  /** The project's tokens as a fraction of the busiest project's, from 0 to 1. */
  readonly share: number
}

/**
 * One project on the overview: its name and worktree count, its tokens, cost,
 * sessions and agents for the window, a bar of its tokens
 * against the busiest project's, and its latest session. The name is a button
 * that stretches over the card, so the whole card selects the project and
 * opens its sessions. While the project's totals load, or when they can't be
 * loaded, the card says so and still opens. While it shows the other window's
 * figures until this window's arrive, it is muted and says so to assistive
 * technology. The name button is described by the card's figures, then the
 * project's folder name, then the footnote when a figure may be low.
 *
 * @example
 * <ProjectCard group={group} totals={totals} share={0.4} />
 */
export function ProjectCard({ group, totals, share }: ProjectCardProps): React.JSX.Element {
  const { t } = useTranslation('overview')
  const select = useSelectedProjectStore((state) => state.select)
  const showSessions = useNavigationStore((state) => state.showSessions)
  const { project, worktrees } = group
  const status = totalsStatus(totals)
  const partial = partialFiguresOf(totals)
  const { latest, refreshing } = totals
  const partialNote = t('partialNote')
  const id = useId()
  const statusId = `${id}-status`
  const folderId = `${id}-folder`
  const describedBy = [
    statusId,
    folderId,
    ...(partialReasonsOf(totals).length > 0 ? [OVERVIEW_FOOTNOTE_ID] : [])
  ].join(' ')

  return (
    <li className={styles.card} data-updating={refreshing}>
      <div className={styles.titleRow}>
        <h2 className={styles.name}>
          <CardOpenButton
            className={styles.open}
            describedBy={describedBy}
            onClick={() => {
              select(project.dirName)
              showSessions()
            }}
          >
            {projectTitle(project)}
          </CardOpenButton>
        </h2>
        {worktrees.length > 0 && (
          <span className={styles.muted}>{t('card.worktrees', { count: worktrees.length })}</span>
        )}
      </div>
      {/* Hidden from view and the name; aria-describedby still exposes it, so same-named cards differ. */}
      <span id={folderId} className="visuallyHidden" aria-hidden="true">
        {project.dirName}
      </span>
      {status === 'ready' && (
        <p id={statusId} className={styles.stats}>
          <span className={styles.tokens}>
            {t('tokens', { count: totals.tokens })}
            {partial.tokens && <PartialMarker note={partialNote} />}
          </span>
          <span>
            {t('apiCost', { value: formatUsd(totals.usd, t) })}
            {partial.cost && <PartialMarker note={partialNote} />}
          </span>
          <span>
            {t('card.sessions', { count: totals.sessions })}
            {partial.sessions && <PartialMarker note={partialNote} />}
          </span>
          <span>
            {t('card.agents', { count: totals.agents })}
            {partial.agents && <PartialMarker note={partialNote} />}
          </span>
          <span className="visuallyHidden">
            {t('card.share', { value: Math.round(share * 100) })}
          </span>
          {refreshing && <span className="visuallyHidden">{t('updating')}</span>}
        </p>
      )}
      {status === 'loading' && (
        <p id={statusId} className={styles.muted}>
          <FigurePlaceholder loading />
        </p>
      )}
      {status === 'error' && (
        <p id={statusId} className={styles.muted}>
          {t('card.error')}
        </p>
      )}
      <div className={styles.track} aria-hidden="true">
        {status === 'ready' && (
          <div className={styles.fill} style={{ inlineSize: `${share * 100}%` }} />
        )}
      </div>
      {status === 'ready' && (
        <p className={styles.muted}>
          {latest === null
            ? t('card.noLatest')
            : latest.title === null
              ? t('card.latestUntitled', { when: latest.latestMs })
              : t('card.latest', {
                  title: `${FIRST_STRONG_ISOLATE}${latest.title}${POP_DIRECTIONAL_ISOLATE}`,
                  when: latest.latestMs
                })}
        </p>
      )}
    </li>
  )
}
