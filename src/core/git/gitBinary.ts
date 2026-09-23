declare const gitBinaryBrand: unique symbol

/**
 * The absolute path of a git executable that {@link locateGit} verified,
 * so callers never run a path they guessed.
 */
export type GitBinary = string & { readonly [gitBinaryBrand]: true }

/**
 * Brands an absolute path as a {@link GitBinary}.
 * @param path - An absolute path to a git executable.
 * @returns The branded path.
 * @throws {Error} When `path` isn't absolute.
 */
export function toGitBinary(path: string): GitBinary {
  if (!path.startsWith('/')) throw new Error('git-binary-not-absolute')
  return path as GitBinary
}
