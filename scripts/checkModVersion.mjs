// Checks that the mod's version equals the app's. Run it through `npm run check:mod`.
import { readFile } from 'node:fs/promises'
import { findVersionProblems } from '../lint/modVersion.mjs'

/**
 * @param {string} path - A JSON file, relative to the repo root.
 * @returns {Promise<unknown>} Its parsed content.
 */
async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'))
}

const problems = findVersionProblems(
  await readJson('package.json'),
  await readJson('mod/.claude-plugin/plugin.json')
)
if (problems.length > 0) {
  console.error(`The mod's version does not follow package.json:\n${problems.join('\n')}`)
  process.exit(1)
}
console.log("The mod's version matches package.json.")
