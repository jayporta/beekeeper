// @ts-check

/**
 * Reads the `version` of a parsed manifest.
 *
 * @param {unknown} manifest - The parsed JSON of package.json or plugin.json.
 * @returns {string | undefined} The version, or undefined when there is no non-empty string.
 */
function readVersion(manifest) {
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) return undefined
  const { version } = /** @type {Record<string, unknown>} */ (manifest)
  return typeof version === 'string' && version !== '' ? version : undefined
}

/**
 * Checks that the mod ships under the same version as the app, since both are released from one tag.
 *
 * @param {unknown} packageJson - The parsed package.json.
 * @param {unknown} pluginJson - The parsed mod/.claude-plugin/plugin.json.
 * @returns {string[]} What is wrong, one message each. Empty when the versions match.
 */
export function findVersionProblems(packageJson, pluginJson) {
  const appVersion = readVersion(packageJson)
  const modVersion = readVersion(pluginJson)
  /** @type {string[]} */
  const problems = []
  if (appVersion === undefined) problems.push('package.json has no version string.')
  if (modVersion === undefined) {
    problems.push('mod/.claude-plugin/plugin.json has no version string.')
  }
  if (appVersion !== undefined && modVersion !== undefined && appVersion !== modVersion) {
    problems.push(
      `mod/.claude-plugin/plugin.json is at ${modVersion} but package.json is at ${appVersion}. Release both under one version.`
    )
  }
  return problems
}
