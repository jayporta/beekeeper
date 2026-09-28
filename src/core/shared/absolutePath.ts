/**
 * Whether `path` is a non-empty absolute POSIX path: the only kind
 * Beekeeper hands to git as a working directory or executable, or keeps
 * once it comes from a transcript. Loosening this predicate is a security
 * change.
 * @param path - A path, possibly untrusted.
 * @returns `true` when it starts with `/`.
 */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/')
}
