import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { CardOpenButton } from '@renderer/components/CardOpenButton'
import { MutedText } from '@renderer/components/MutedText'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { ShareBar } from '@renderer/components/ShareBar'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import type { ProjectGroup } from '../../../../shared/projects/groupProjects'
import { projectTitle } from '../../../../shared/projects/projectTitle'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { FigurePlaceholder } from './FigurePlaceholder'
import { OVERVIEW_FOOTNOTE_ID } from './overviewFootnoteId'
import { partialFiguresOf, partialReasonsOf } from './partialReasons'
import styles from './ProjectTableRow.module.css'
import { totalsStatus, type AggregateTotals } from './sumTotals'

/** Marks the start of text whose direction is its own, so it doesn't reorder the text around it. */
const FIRST_STRONG_ISOLATE = '⁨'
/** Ends the text {@link FIRST_STRONG_ISOLATE} began. */
const POP_DIRECTIONAL_ISOLATE = '⁩'

/** Props for {@link ProjectTableRow}. */
interface ProjectTableRowProps {
  /** The project and its worktrees. */
  readonly group: ProjectGroup
  /** What the project and its worktrees add up to. */
  readonly totals: AggregateTotals
  /** The project's tokens as a fraction of the busiest project's, from 0 to 1. */
  readonly barShare: number
  /** The project's tokens as a whole percent of every project's, or `null` while that total is still arriving. */
  readonly sharePercent: number | null
}

/**
 * One project as a row of the overview's table: its name and worktree count
 * (or folder name), its latest session, a bar of its tokens against the
 * busiest project's, and its tokens, sessions, agents and share of all tokens
 * for the window. The name is a button that stretches over the row, so the
 * whole row selects the project and opens its sessions. While the project's
 * totals load, or can't be loaded, the row says so and still opens. While it
 * shows the other window's figures until this window's arrive, it is muted and
 * says so to assistive technology. The name button is described by the row's
 * figures, then the project's folder name, then the footnote when a figure may
 * be low.
 *
 * @example
 * <tbody><ProjectTableRow group={group} totals={totals} barShare={0.4} sharePercent={25} /></tbody>
 */
export function ProjectTableRow({
  group,
  totals,
  barShare,
  sharePercent
}: ProjectTableRowProps): React.JSX.Element {
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

  const figure = (text: string, isPartial: boolean): React.JSX.Element =>
    status === 'ready' ? (
      <>
        {text}
        {isPartial && <PartialMarker note={partialNote} />}
      </>
    ) : (
      <FigurePlaceholder loading={status === 'loading'} />
    )

  return (
    <tr className={styles.row} data-updating={refreshing}>
      <th scope="row" className={styles.project}>
        <div className={styles.projectBody}>
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
          {worktrees.length > 0 ? (
            <>
              <MutedText as="span" wrapAnywhere className={styles.sub}>
                {t('card.worktrees', { count: worktrees.length })}
              </MutedText>
              {/* Hidden from view and the name; aria-describedby still exposes it, so same-named rows differ. */}
              <span id={folderId} className="visuallyHidden" aria-hidden="true">
                {project.dirName}
              </span>
            </>
          ) : (
            <MutedText as="span" wrapAnywhere className={styles.sub} id={folderId}>
              {project.dirName}
            </MutedText>
          )}
          {status === 'ready' && (
            <span id={statusId} className="visuallyHidden">
              <span>{t('tokens', { count: totals.tokens })}</span>
              <span>{t('card.sessions', { count: totals.sessions })}</span>
              <span>{t('card.agents', { count: totals.agents })}</span>
              {sharePercent !== null && (
                <span>{t('projects.shareOfTotal', { value: sharePercent })}</span>
              )}
              {refreshing && <span>{t('updating')}</span>}
            </span>
          )}
        </div>
      </th>
      <td className={styles.latest}>
        {status === 'ready' && (
          <MutedText as="span" wrapAnywhere>
            {latest === null
              ? t('card.noLatest')
              : latest.title === null
                ? t('card.latestUntitled', { when: latest.latestMs })
                : t('card.latest', {
                    title: `${FIRST_STRONG_ISOLATE}${latest.title}${POP_DIRECTIONAL_ISOLATE}`,
                    when: latest.latestMs
                  })}
          </MutedText>
        )}
        {status === 'loading' && (
          <span id={statusId}>
            <FigurePlaceholder loading />
          </span>
        )}
        {status === 'error' && (
          <MutedText as="span" id={statusId} wrapAnywhere>
            {t('card.error')}
          </MutedText>
        )}
      </td>
      <td className={styles.barCell}>
        <ShareBar share={status === 'ready' ? barShare : 0} />
      </td>
      <td className={styles.number}>
        {figure(t('figure.compact', { value: totals.tokens }), partial.tokens)}
      </td>
      <td className={styles.number}>
        {figure(t('figure.integer', { value: totals.sessions }), partial.sessions)}
      </td>
      <td className={styles.number}>
        {figure(t('figure.integer', { value: totals.agents }), partial.agents)}
      </td>
      <td className={styles.number}>
        {sharePercent === null ? (
          <FigurePlaceholder loading />
        ) : (
          figure(t('percent', { value: sharePercent }), false)
        )}
      </td>
    </tr>
  )
}
