/**
 * Whether the project list has at least one project to show. `ProjectsGate`
 * shows its children only then, and the query client leaves a failed list
 * with none for an explicit Retry instead of refetching it on window focus.
 *
 * @param data - What the project list query holds, or `undefined` before it loads.
 * @returns `true` when `data` is a non-empty array.
 */
export function hasProjectsToShow(data: unknown): boolean {
  return Array.isArray(data) && data.length > 0
}
