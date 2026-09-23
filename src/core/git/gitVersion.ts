/** A git release, as `major.minor`. */
export interface GitVersion {
  /** The major version number. */
  readonly major: number
  /** The minor version number. */
  readonly minor: number
}

/**
 * The oldest git Beekeeper supports. It is the first release that has the
 * `--no-lazy-fetch` option, which keeps read-only commands from fetching.
 */
export const MIN_GIT_VERSION: GitVersion = { major: 2, minor: 44 }

/**
 * Parses the output of `git --version`.
 * @param output - Text such as `git version 2.39.5 (Apple Git-154)`.
 * @returns The version, or `undefined` when the text isn't recognizable.
 */
export function parseGitVersion(output: string): GitVersion | undefined {
  const match = /^git version (\d{1,4})\.(\d{1,4})/.exec(output.trim())
  if (match === null) return undefined
  return { major: Number(match[1]), minor: Number(match[2]) }
}

/**
 * Whether a git release meets {@link MIN_GIT_VERSION}.
 * @param version - The release to check.
 * @returns `true` when it is at least the minimum.
 */
export function isSupportedGitVersion(version: GitVersion): boolean {
  if (version.major !== MIN_GIT_VERSION.major) return version.major > MIN_GIT_VERSION.major
  return version.minor >= MIN_GIT_VERSION.minor
}
