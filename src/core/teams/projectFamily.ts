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
 * @param dirName - A project folder name.
 * @param listed - Every listed project folder name.
 * @returns The parent folder's name, or `null` when `dirName` is not a
 * worktree folder of a listed folder.
 */
export function worktreeParentOf(
  dirName: ProjectDirName,
  listed: readonly ProjectDirName[]
): ProjectDirName | null {
  const at = dirName.indexOf(WORKTREE_MARKER)
  if (at < 0 || at + WORKTREE_MARKER.length === dirName.length) return null
  const parent = dirName.slice(0, at)
  return listed.find((name) => name === parent) ?? null
}

/**
 * Lists a project's family: its base folder (the folder itself, or its parent
 * when it is a worktree folder) followed by every listed worktree folder of
 * that base.
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
  const base = worktreeParentOf(dirName, listed) ?? dirName
  return [base, ...listed.filter((name) => worktreeParentOf(name, listed) === base)]
}
