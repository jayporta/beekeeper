import { useTranslation } from 'react-i18next'
import { Footnote } from '@renderer/components/Footnote'
import { StatRow } from '@renderer/components/StatRow'
import { StatRowItem } from '@renderer/components/StatRowItem'
import { groupProjects } from '../../../../shared/projects/groupProjects'
import { useProjects } from '@renderer/features/projects/useProjects'
import { formatUsd } from '@renderer/i18n/formatUsd'
import { PROJECT_STATS_FOOTNOTE_ID } from './projectStatsFootnoteId'
import type { FolderStats } from './folderStats'

/** Props for {@link ProjectStats}. */
interface ProjectStatsProps {
  /** What the folder's sessions add up to. */
  readonly stats: FolderStats
  /** The folder the figures are for, exactly as on disk. */
  readonly dirName: string
}

/**
 * The stat row under the sessions header: the folder's sessions, tokens, cost
 * at API prices, agents, worktrees, and latest activity, each beside its
 * label. The worktree count is left out for a worktree folder. A figure that
 * may be low carries a marker, and a footnote below the row says why.
 *
 * @example
 * <ProjectStats stats={folderStats(items, dirName)} dirName={dirName} />
 */
export function ProjectStats({ stats, dirName }: ProjectStatsProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const { t: tCommon } = useTranslation('common')
  const { data: projects } = useProjects()
  const group = projects && groupProjects(projects).find((g) => g.project.dirName === dirName)
  const note = t('stats.partialNote')
  const sentences = [
    ...stats.reasons.map((reason) => tCommon(`partialReason.${reason}`)),
    tCommon('partialReason.mayBeLow')
  ]

  return (
    <>
      <StatRow>
        <StatRowItem
          label={t('stats.sessions')}
          partialNote={stats.partial.sessions ? note : undefined}
        >
          {t('stats.integer', { value: stats.sessions })}
        </StatRowItem>
        <StatRowItem
          label={t('stats.tokens')}
          partialNote={stats.partial.tokens ? note : undefined}
        >
          {t('figure.compact', { value: stats.tokens })}
        </StatRowItem>
        <StatRowItem label={t('stats.cost')} partialNote={stats.partial.cost ? note : undefined}>
          {formatUsd(stats.usd, t)}
        </StatRowItem>
        <StatRowItem
          label={t('stats.agents')}
          partialNote={stats.partial.agents ? note : undefined}
        >
          {t('stats.integer', { value: stats.agents })}
        </StatRowItem>
        {group && (
          <StatRowItem label={t('stats.worktrees')}>
            {t('stats.integer', { value: group.worktrees.length })}
          </StatRowItem>
        )}
        <StatRowItem label={t('stats.latest')}>
          {stats.latestMs === null ? t('stats.none') : t('lastActive', { value: stats.latestMs })}
        </StatRowItem>
      </StatRow>
      {stats.reasons.length > 0 && (
        <Footnote
          id={PROJECT_STATS_FOOTNOTE_ID}
          label={t('stats.footnoteLabel')}
          sentences={sentences}
        />
      )}
    </>
  )
}
