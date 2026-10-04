/**
 * Whether the project in effect changed to another project. The first project
 * to load is the baseline, not a change, and a gap while projects are
 * unavailable (`null`) is not a change either. Anything that leaves the view
 * of an old project behind, such as returning navigation to the sessions list,
 * follows this one rule.
 *
 * @param baseline - The folder name the view started under, or `null` before any project loaded.
 * @param current - The folder name in effect now, or `null` while projects are unavailable.
 * @returns `true` when both are known and differ.
 */
export function isProjectChange(baseline: string | null, current: string | null): boolean {
  return baseline !== null && current !== null && baseline !== current
}
