/**
 * Decides whether a project's worktrees show in the sidebar: what the person
 * chose, else open only while the group holds the current page.
 *
 * @param toggled - The groups the person opened or closed, by top-level folder name.
 * @param options - The group's folder name, and whether the current page is the project or one of its worktrees.
 * @returns `true` when the worktrees show.
 */
export function isGroupExpanded(
  toggled: Readonly<Record<string, boolean>>,
  options: { readonly dirName: string; readonly holdsCurrent: boolean }
): boolean {
  return toggled[options.dirName] ?? options.holdsCurrent
}
