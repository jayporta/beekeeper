/**
 * Whether `path` is a non-empty absolute POSIX path: the only kind Beekeeper
 * hands to git as a working directory, or runs as a git executable.
 * @param path - A path, possibly untrusted.
 * @returns `true` when it starts with `/`.
 */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/')
}
