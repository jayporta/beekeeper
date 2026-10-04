import { useTranslation } from 'react-i18next'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import type { ProjectGroup } from '@renderer/features/projects/groupProjects'
import { projectTitle } from '@renderer/features/projects/projectTitle'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { FigurePlaceholder } from './FigurePlaceholder'
import { formatUsd } from './formatUsd'
import { PartialMark } from './PartialMark'
import styles from './ProjectCard.module.css'
import { areCountsPartial, isPartial, totalsStatus, type AggregateTotals } from './sumTotals'

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
 * One project on the overview: its folder name and worktree count, its name,
 * its tokens, cost, sessions and agents for the window, a bar of its tokens
 * against the busiest project's, and its latest session. The name is a button
 * that stretches over the card, so the whole card selects the project and
 * opens its sessions. While the project's totals load, or when they can't be
 * loaded, the card says so and still opens.
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
  const countsPartial = areCountsPartial(totals)
  const { latest } = totals

  return (
    <li className={styles.card}>
      <div className={styles.kickerRow}>
        <bdi className={styles.path}>{project.dirName}</bdi>
        {worktrees.length > 0 && (
          <span className={styles.muted}>{t('card.worktrees', { count: worktrees.length })}</span>
        )}
      </div>
      <h2 className={styles.name}>
        <button
          type="button"
          className={styles.open}
          onClick={() => {
            select(project.dirName)
            showSessions()
          }}
        >
          {projectTitle(project)}
        </button>
      </h2>
      {status === 'ready' && (
        <p className={styles.stats}>
          <span className={styles.tokens}>
            {t('tokens', { count: totals.tokens })}
            {isPartial(totals) && <PartialMark />}
          </span>
          <span>{t('apiCost', { value: formatUsd(totals.usd, t) })}</span>
          <span>
            {t('card.sessions', { count: totals.sessions })}
            {countsPartial && <PartialMark />}
          </span>
          <span>
            {t('card.agents', { count: totals.agents })}
            {countsPartial && <PartialMark />}
          </span>
          <span className="visuallyHidden">
            {t('card.share', { value: Math.round(share * 100) })}
          </span>
        </p>
      )}
      {status === 'loading' && (
        <p className={styles.muted}>
          <FigurePlaceholder loading />
        </p>
      )}
      {status === 'error' && <p className={styles.muted}>{t('card.error')}</p>}
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
              : t('card.latest', { title: latest.title, when: latest.latestMs })}
        </p>
      )}
    </li>
  )
}
