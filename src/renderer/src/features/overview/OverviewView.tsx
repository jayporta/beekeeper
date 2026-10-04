import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusMessage } from '@renderer/components/StatusMessage'
import { groupProjects } from '@renderer/features/projects/groupProjects'
import { useProjects } from '@renderer/features/projects/useProjects'
import { OverviewFootnote } from './OverviewFootnote'
import { OverviewHeader } from './OverviewHeader'
import styles from './OverviewView.module.css'
import { partialReasonsOf } from './partialReasons'
import { ProjectCard } from './ProjectCard'
import { overviewTotals, projectTotalsOf } from './projectTotalsOf'
import { shareOfLargest } from './shareOfLargest'
import { totalsStatus } from './sumTotals'
import { TotalsStrip } from './TotalsStrip'
import { useProjectTotals } from './useProjectTotals'

/**
 * The all-projects overview: a header with the 7 or 30 day window, the totals
 * across every project, a card for each project, and a note on any figure
 * that may be low. Each project loads on its own, so a card fills in as its
 * totals arrive and a project that can't be read doesn't hold up the rest.
 * With nothing in the window it says so, above cards that show zero.
 *
 * @example
 * <main><OverviewView /></main>
 */
export function OverviewView(): React.JSX.Element {
  const { t } = useTranslation('overview')
  const { data: projects } = useProjects()
  const { window: range, byFolder } = useProjectTotals()

  const groups = useMemo(() => groupProjects(projects ?? []), [projects])
  const cards = useMemo(
    () => groups.map((group) => ({ group, totals: projectTotalsOf(group, byFolder) })),
    [groups, byFolder]
  )
  const overall = useMemo(() => overviewTotals(groups, byFolder), [groups, byFolder])

  const largest = Math.max(
    0,
    ...cards.map(({ totals }) => (totalsStatus(totals) === 'ready' ? totals.tokens : 0))
  )
  const { folders } = overall
  const idle =
    folders.loading === 0 &&
    folders.failed === 0 &&
    overall.tokens === 0 &&
    overall.sessions === 0 &&
    overall.agents === 0

  return (
    <div className={styles.view}>
      <OverviewHeader />
      {groups.length > 0 && <TotalsStrip totals={overall} range={range} />}
      {idle && (
        <StatusMessage
          headingLevel={2}
          heading={t('empty.heading')}
          body={t('empty.body', { range: t(`range.${range}`) })}
        />
      )}
      <ul className={styles.cards}>
        {cards.map(({ group, totals }) => (
          <ProjectCard
            key={group.project.dirName}
            group={group}
            totals={totals}
            share={shareOfLargest(totals.tokens, largest)}
          />
        ))}
      </ul>
      <OverviewFootnote reasons={partialReasonsOf(overall)} />
    </div>
  )
}
