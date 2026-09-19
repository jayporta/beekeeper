import { spawnSync } from 'node:child_process'
import { withoutGitEnv } from './envSanitize.mjs'

const MAX_BUFFER = 512 * 1024 * 1024

const CHECKS = [
  ['lint', ['run', 'lint']],
  ['format:check', ['run', 'format:check']],
  ['typecheck', ['run', 'typecheck']],
  ['test', ['run', 'test']]
]

/**
 * Runs lint, format:check, typecheck, and test from the repo root, in
 * order, stopping at the first failure. Runs with every `GIT_*`
 * environment variable removed, so a check that shells out to git
 * can't read or write the index this hook is validating.
 * @param {string} repoRoot - The repository's absolute root path.
 * @returns {string | null} The failing check's name and the last 40 lines of its output, or null if all passed.
 */
export function runGateChecks(repoRoot) {
  const env = withoutGitEnv(process.env)

  for (const [name, args] of CHECKS) {
    const result = spawnSync('npm', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER,
      env
    })
    if (result.status !== 0) {
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
      const tail = output.split('\n').slice(-40).join('\n')
      return `"npm run ${name}" failed:\n\n${tail}`
    }
  }
  return null
}
