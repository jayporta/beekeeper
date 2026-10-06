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
import { TotalsAnnouncement } from './TotalsAnnouncement'
import { TotalsStrip } from './TotalsStrip'
import type { TotalsOutcome } from './useTotalsAnnouncement'
import { useProjectTotals } from './useProjectTotals'

/**
 * The all-projects overview: a header with the 7 or 30 day window, the totals
 * across every project, a card for each project, and a note on any figure
 * that may be low. Each project loads on its own, so a card fills in as its
 * totals arrive and a project that can't be read doesn't hold up the rest.
 * With nothing in the window, and no session it couldn't read, it says so,
 * above cards that show zero. While a
 * window's totals load, or show the other window's until they arrive, the cards
 * are marked busy and the empty message waits. A status region announces once
 * when the window's totals have all arrived (noting when some may be low), that
 * the window is empty, or that none could be loaded, and again if that outcome
 * later changes.
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
  const settled = folders.loading === 0 && !overall.refreshing
  const idle =
    settled &&
    folders.failed === 0 &&
    overall.partial.unreadable === 0 &&
    overall.tokens === 0 &&
    overall.sessions === 0 &&
    overall.agents === 0
  const reasons = partialReasonsOf(overall)
  let outcome: TotalsOutcome = 'updated'
  if (totalsStatus(overall) === 'error') outcome = 'failed'
  else if (idle) outcome = 'empty'
  else if (reasons.length > 0) outcome = 'partial'

  return (
    <div className={styles.view}>
      <OverviewHeader />
      <TotalsAnnouncement range={range} settled={settled} outcome={outcome} />
      {groups.length > 0 && <TotalsStrip totals={overall} range={range} />}
      {idle && (
        <StatusMessage
          headingLevel={2}
          heading={t('empty.heading')}
          body={t(`empty.body.${range}`, { range: t(`range.${range}`) })}
        />
      )}
      <ul className={styles.cards} aria-busy={!settled}>
        {cards.map(({ group, totals }) => (
          <ProjectCard
            key={group.project.dirName}
            group={group}
            totals={totals}
            share={shareOfLargest(totals.tokens, largest)}
          />
        ))}
      </ul>
      <OverviewFootnote reasons={reasons} />
    </div>
  )
}
