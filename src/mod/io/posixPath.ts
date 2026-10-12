/** Folds `.`, `..` and repeated slashes out of a path, like `node:path/posix` `normalize`. */
function normalize(path: string): string {
  const isAbsolute = path.startsWith('/')
  const kept: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment !== '..') kept.push(segment)
    else if (kept.length > 0 && kept.at(-1) !== '..') kept.pop()
    else if (!isAbsolute) kept.push('..')
  }
  const body = kept.join('/')
  const normalized = isAbsolute ? `/${body}` : body || '.'
  return path.endsWith('/') && !normalized.endsWith('/') ? `${normalized}/` : normalized
}

/**
 * Joins path segments with `/`, like `node:path/posix` `join`.
 *
 * @param segments - The segments to join; empty ones are skipped.
 * @returns The joined, normalized path, or `.` when nothing is left.
 */
export function joinPath(...segments: string[]): string {
  const joined = segments.filter((segment) => segment !== '').join('/')
  return joined === '' ? '.' : normalize(joined)
}

/**
 * Resolves a path to an absolute one, like `node:path/posix` `resolve` with `cwd` as the base.
 *
 * @param path - The path to resolve.
 * @param cwd - The absolute directory a relative path starts from.
 * @returns The absolute path, without a trailing slash unless it is the root.
 */
export function resolvePath(path: string, cwd: string): string {
  const resolved = normalize(path.startsWith('/') ? path : `${cwd}/${path}`)
  return resolved.length > 1 && resolved.endsWith('/') ? resolved.slice(0, -1) : resolved
}
