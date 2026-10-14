// Fails when a mod version may not be published on top of the one the mod-release branch holds.
// Usage: node scripts/checkModPublishOrder.mjs <version> [<published version>]
// Leave the second argument out on the first publish, when the branch does not exist yet.
// The release workflow runs this without installing anything, so it uses no dependencies.
import { findPublishProblems } from '../lint/modPublishOrder.mjs'

const [version, publishedVersion] = process.argv.slice(2)
if (version === undefined) {
  console.error('Usage: node scripts/checkModPublishOrder.mjs <version> [<published version>]')
  process.exit(2)
}

const problems = findPublishProblems(version, publishedVersion)
if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`Version ${version} may be published.`)
