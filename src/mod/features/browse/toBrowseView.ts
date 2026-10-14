import { replaceUnprintable } from '../../../core/transcript/replaceUnprintable'
import type { ProjectDto } from '../../../shared/ipc/projectDto'
import { groupProjects } from '../../../shared/projects/groupProjects'
import { projectLabel } from '../../../shared/projects/projectLabel'
import { projectTitle } from '../../../shared/projects/projectTitle'
import {
  agentCountLabel,
  hasAgents,
  type AgentCountWords
} from '../../../shared/sessions/agentCountLabel'
import { cardFigures } from '../../../shared/sessions/cardFigures'
import { lastActiveMs } from '../../../shared/sessions/lastActiveMs'
import type { SessionRow } from '../../../shared/sessions/sessionRow'
import { MAX_BROWSE_ROWS, type BrowseProject, type BrowseRow } from './browseView'

/**
 * The projects as the picker lists them: each project followed by its
 * worktrees, a worktree reading `<parent> / <worktree name>`.
 *
 * @param projects - The listed projects.
 * @returns The picker's options, with every label cleaned.
 */
export function browseProjects(projects: readonly ProjectDto[]): readonly BrowseProject[] {
  return groupProjects(projects).flatMap(({ project, worktrees }) => [
    { dirName: project.dirName, label: replaceUnprintable(projectLabel(project)) },
    ...worktrees.map((worktree) => ({
      dirName: worktree.dirName,
      label: replaceUnprintable(`${projectLabel(project)} / ${projectTitle(worktree)}`)
    }))
  ])
}

function browseRow(row: SessionRow, depth: 0 | 1, agentCount: AgentCountWords): BrowseRow {
  const { item } = row
  const figures = cardFigures(item).figures
  const hint = row.label.idHint
  return {
    key: row.key,
    ref: { projectDirName: item.projectDirName, sessionId: item.sessionId },
    label: replaceUnprintable(hint === null ? row.label.text : `${row.label.text} ${hint}`),
    depth,
    tokens: figures?.tokens ?? null,
    tokensPartial: figures?.tokensPartial ?? false,
    lastActiveMs: lastActiveMs(item),
    agents: hasAgents(item) ? agentCountLabel(item, agentCount) : null
  }
}

/**
 * The session rows as the Browse screen lists them, in order: each lead
 * followed by its teammates. Only the first {@link MAX_BROWSE_ROWS} are kept.
 *
 * @param rows - The grouped rows of a project.
 * @param agentCount - The agent count words.
 * @returns The kept rows and how many were left out.
 */
export function browseRows(
  rows: readonly SessionRow[],
  agentCount: AgentCountWords
): { readonly rows: readonly BrowseRow[]; readonly hiddenCount: number } {
  const all = rows.flatMap((row) => [
    { row, depth: 0 as const },
    ...row.teammates.map((mate) => ({ row: mate, depth: 1 as const }))
  ])
  return {
    rows: all.slice(0, MAX_BROWSE_ROWS).map(({ row, depth }) => browseRow(row, depth, agentCount)),
    hiddenCount: Math.max(0, all.length - MAX_BROWSE_ROWS)
  }
}
