// @ts-check

/** A release version, such as 0.1.0. Prerelease and build suffixes are not release versions. */
const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

/**
 * @param {string} version
 * @returns {bigint[] | undefined} The major, minor and patch numbers, or undefined when it is not a release version.
 */
function parseRelease(version) {
  const match = RELEASE_VERSION.exec(version)
  return match ? match.slice(1).map(BigInt) : undefined
}

/**
 * Checks that a mod version may be published on top of the one the mod-release branch holds. Claude
 * Code caches an install by version, so a version at or below the branch's would never reach users,
 * and an older one would roll the branch back.
 *
 * @param {string} version - The version to publish.
 * @param {string | undefined} publishedVersion - The version at the branch's tip, or undefined when the branch does not exist yet.
 * @returns {string[]} Why it may not be published, one message each. Empty when it may.
 */
export function findPublishProblems(version, publishedVersion) {
  const next = parseRelease(version)
  /** @type {string[]} */
  const problems = []
  if (next === undefined) {
    problems.push(`"${version}" is not a release version like 1.2.3. Only those are published.`)
  }
  const published = publishedVersion === undefined ? undefined : parseRelease(publishedVersion)
  if (publishedVersion !== undefined && published === undefined) {
    problems.push(
      `The mod-release branch holds "${publishedVersion}", which is not a release version to compare with.`
    )
  }
  if (next === undefined || published === undefined) return problems
  const [a = 0n, b = 0n, c = 0n] = next
  const [x = 0n, y = 0n, z = 0n] = published
  const isNewer = a !== x ? a > x : b !== y ? b > y : c > z
  if (!isNewer) {
    problems.push(
      `Version ${version} is not above ${publishedVersion}, the one the mod-release branch holds. Bump the version to publish.`
    )
  }
  return problems
}
