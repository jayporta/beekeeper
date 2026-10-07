/**
 * Joins a component's own class with one a caller adds.
 *
 * @param base - The component's own class. A CSS Module lookup is typed `string | undefined`, so
 * that is accepted as is.
 * @param extra - The caller's class, or `undefined` for none.
 * @returns Both classes, space-separated, or whichever one is defined, or `undefined` when neither is.
 */
export function withClassName(
  base: string | undefined,
  extra: string | undefined
): string | undefined {
  if (extra === undefined) return base
  return base === undefined ? extra : `${base} ${extra}`
}
