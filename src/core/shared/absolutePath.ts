/**
 * Whether `path` is a non-empty absolute POSIX path.
 * @param path - A path, possibly untrusted.
 * @returns `true` when it starts with `/`.
 */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/')
}
