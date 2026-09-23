/**
 * Whether `path` is a non-empty absolute POSIX path, the only kind Beekeeper
 * hands to git as a working directory.
 * @param path - A directory path, possibly untrusted.
 * @returns `true` when it starts with `/`.
 */
export function isAbsoluteDir(path: string): boolean {
  return path.startsWith('/')
}
