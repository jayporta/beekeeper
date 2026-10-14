/**
 * Shortens a file path to start at the project's folder, so
 * `/Users/me/code/app/src/a.ts` reads `app/src/a.ts` for the project `app`.
 * The first whole path segment equal to the label is where it starts.
 *
 * @param filePath - The path as the tool reported it. Untrusted text.
 * @param projectLabel - The project's folder name, or `null` when it isn't known.
 * @returns The path from the project's folder on, or the whole path when there
 * is no label or no segment matches it.
 */
export function projectRelativePath(filePath: string, projectLabel: string | null): string {
  if (projectLabel === null || projectLabel === '') return filePath
  const at = filePath.indexOf(`/${projectLabel}/`)
  return at === -1 ? filePath : filePath.slice(at + 1)
}
