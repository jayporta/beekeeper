const NUMERIC_CORE = /^(\d+)\.(\d+)\.(\d+)/

/** The leading `major.minor.patch` of a version string as numbers, or undefined when it has none. */
function numericCore(version: string | undefined): readonly number[] | undefined {
  const match = version === undefined ? null : NUMERIC_CORE.exec(version)
  return match ? match.slice(1).map(Number) : undefined
}

/**
 * Whether a Claude Code version is at least a minimum, comparing `major.minor.patch` numerically.
 *
 * @param version - The engine's version; `base` is the release a dev build is made from.
 * @param minimum - The oldest acceptable version, such as `2.1.296`.
 * @returns True when the version's numeric core is at or above the minimum's. A dev build of the
 * minimum counts as meeting it. A version with no numeric core never does.
 */
export function meetsMinimumVersion(
  version: { readonly version: string; readonly base?: string },
  minimum: string
): boolean {
  const actual = numericCore(version.base) ?? numericCore(version.version)
  const required = numericCore(minimum)
  if (!actual || !required) return false
  for (const [index, part] of required.entries()) {
    const have = actual[index] ?? 0
    if (have !== part) return have > part
  }
  return true
}
