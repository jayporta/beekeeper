import type { ProjectDirName } from '../transcript/ids'

/**
 * What Claude Code's folder naming makes of `<repo>/.claude/worktrees/<x>`:
 * every non-alphanumeric character of the path becomes `-`.
 */
const WORKTREE_MARKER = '--claude-worktrees-'

/**
 * Finds the listed folder a worktree folder belongs to. The parent is the
 * text before the first `--claude-worktrees-` in the name, and only counts
 * when it is itself listed and something follows the marker. Names are
 * compared as text, never decoded back to paths.
 *
 * @remarks
 * The lookup is one set membership test, so a caller resolving every listed
 * folder builds the set once and stays linear in the listing.
 *
 * @param dirName - A project folder name.
 * @param listed - Every listed project folder name.
 * @returns The parent folder's name, or `null` when `dirName` is not a
 * worktree folder of a listed folder.
 */
export function worktreeParentOf(
  dirName: ProjectDirName,
  listed: ReadonlySet<ProjectDirName>
): ProjectDirName | null {
  const at = dirName.indexOf(WORKTREE_MARKER)
  if (at < 0 || at + WORKTREE_MARKER.length === dirName.length) return null
  // The text is only a `ProjectDirName` once the set confirms it is listed.
  const parent = dirName.slice(0, at) as ProjectDirName
  return listed.has(parent) ? parent : null
}

/**
 * Lists a project's family: its base folder (the folder itself, or its parent
 * when it is a worktree folder) followed by every listed worktree folder of
 * that base.
 *
 * @remarks
 * Builds the set of listed names once, so the cost is linear in the listing.
 *
 * @param dirName - A listed project folder name.
 * @param listed - Every listed project folder name.
 * @returns The family's folder names, the base first, then the worktrees in
 * listed order.
 */
export function projectFamilyOf(
  dirName: ProjectDirName,
  listed: readonly ProjectDirName[]
): ProjectDirName[] {
  const names = new Set(listed)
  const base = worktreeParentOf(dirName, names) ?? dirName
  return [base, ...listed.filter((name) => worktreeParentOf(name, names) === base)]
}
