import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@renderer/components/Card'
import { MutedText } from '@renderer/components/MutedText'
import { ProjectTableRow } from './ProjectTableRow'
import styles from './ProjectsTable.module.css'
import { shareOfLargest } from '@renderer/components/shareOfLargest'
import { shareOfTotal } from '@renderer/components/shareOfTotal'
import { PROJECT_SORT_KEYS, sortProjects, type ProjectSortKey } from './sortProjects'
import { useProjectSortStore } from './state/useProjectSortStore'
import { totalsStatus, type AggregateTotals } from './sumTotals'
import type { ProjectGroupItem } from './useProjectGroupTotals'

/** Props for {@link ProjectsTable}. */
interface ProjectsTableProps {
  /** Each project with its totals, in sidebar order. */
  readonly items: readonly ProjectGroupItem[]
  /** Every project added together, for the share column. */
  readonly overall: AggregateTotals
  /** Whether every project's totals have arrived for the chosen window. */
  readonly settled: boolean
  /** What goes under the table, such as the footnote that explains a "¹". */
  readonly children?: React.ReactNode
}

function isProjectSortKey(value: string): value is ProjectSortKey {
  return PROJECT_SORT_KEYS.some((key) => key === value)
}

/**
 * The overview's projects as a table in a card, with a native menu that sorts
 * it by tokens, latest session or name. The table scrolls sideways inside the
 * card, in a region the keyboard can scroll, when it is wider than its room.
 * It is marked busy until `settled`. The share column waits for every
 * project's totals, so it doesn't change as projects arrive.
 *
 * @example
 * <ProjectsTable items={items} overall={overall} settled={settled}>
 *   <OverviewFootnote reasons={reasons} />
 * </ProjectsTable>
 */
export function ProjectsTable({
  items,
  overall,
  settled,
  children
}: ProjectsTableProps): React.JSX.Element {
  const { t } = useTranslation('overview')
  const sort = useProjectSortStore((state) => state.sort)
  const setSort = useProjectSortStore((state) => state.setSort)
  const headingId = useId()
  const selectId = useId()
  const sorted = sortProjects(items, sort)
  const largest = Math.max(
    0,
    ...items.map(({ totals }) => (totalsStatus(totals) === 'ready' ? totals.tokens : 0))
  )
  const totalKnown = overall.folders.loading === 0

  return (
    <Card className={styles.card}>
      <div className={styles.titleRow}>
        <h2 id={headingId} className={styles.heading}>
          {t('projects.heading')}
        </h2>
        <div className={styles.sort}>
          <label htmlFor={selectId}>
            <MutedText as="span">{t('projects.sortBy')}</MutedText>
          </label>
          <select
            id={selectId}
            className={styles.select}
            value={sort}
            onChange={(event) => {
              if (isProjectSortKey(event.target.value)) setSort(event.target.value)
            }}
          >
            {PROJECT_SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(`projects.sort.${key}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div role="region" aria-labelledby={headingId} tabIndex={0} className={styles.scroll}>
        <table className={styles.table} aria-busy={!settled}>
          <thead>
            <tr>
              <th scope="col">{t('projects.col.project')}</th>
              <th scope="col">{t('projects.col.latest')}</th>
              <th scope="col">
                <span className="visuallyHidden">{t('projects.col.bar')}</span>
              </th>
              <th scope="col" className={styles.number}>
                {t('projects.col.tokens')}
              </th>
              <th scope="col" className={styles.number}>
                {t('projects.col.sessions')}
              </th>
              <th scope="col" className={styles.number}>
                {t('projects.col.agents')}
              </th>
              <th scope="col" className={styles.number}>
                {t('projects.col.share')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ group, totals }) => (
              <ProjectTableRow
                key={group.project.dirName}
                group={group}
                totals={totals}
                barShare={shareOfLargest(totals.tokens, largest)}
                sharePercent={totalKnown ? shareOfTotal(totals.tokens, overall.tokens) : null}
              />
            ))}
          </tbody>
        </table>
      </div>
      {children}
    </Card>
  )
}
