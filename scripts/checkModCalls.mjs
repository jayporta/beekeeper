// Checks the built mod against the call allowlist. Run from the repo root after `npm run build:mod`.
// Needs the `claude` CLI on PATH (CI installs it globally; it is too large to be a devDependency).
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { MOD_ALLOWLIST } from '../lint/modCallAllowlist.mjs'
import { findViolations, parseValidateReport } from '../lint/modCalls.mjs'

const run = promisify(execFile)

/**
 * Runs `claude plugin validate mod --json --strict`. Validate exits non-zero when it finds errors but
 * still prints the report, so a failed run's output is read the same way.
 *
 * @returns {Promise<string>} The report text.
 */
async function validate() {
  try {
    return (
      await run('claude', ['plugin', 'validate', 'mod', '--json', '--strict'], {
        maxBuffer: 16 * 1024 * 1024
      })
    ).stdout
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error && error.stdout) {
      return String(error.stdout)
    }
    throw error
  }
}

const violations = findViolations(parseValidateReport(JSON.parse(await validate())), MOD_ALLOWLIST)
if (violations.length > 0) {
  console.error(
    `The mod breaks its call allowlist (lint/modCallAllowlist.mjs):\n${violations.join('\n')}`
  )
  process.exit(1)
}
console.log('The mod stays inside its call allowlist.')
