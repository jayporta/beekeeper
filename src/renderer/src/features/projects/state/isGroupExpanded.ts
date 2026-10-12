/**
 * Decides whether a project's worktrees show in the sidebar: what the person
 * chose, else open only while the group holds the current page.
 *
 * @param chosen - Whether the person opened (`true`) or closed (`false`) the group, or `undefined` when they did neither.
 * @param holdsCurrent - Whether the current page is the project or one of its worktrees.
 * @returns `true` when the worktrees show.
 */
export function isGroupExpanded(chosen: boolean | undefined, holdsCurrent: boolean): boolean {
  return chosen ?? holdsCurrent
}
