#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hashDiff, requiredReviews } from './lib/reviewScope.mjs'
import { findGitDir, getDiffAndPaths, RECEIPT_NAME } from './lib/gitProcess.mjs'
import { describeRequiredReviews } from './lib/gateMessages.mjs'

/**
 * Prints the reviews the currently staged index would require.
 * @returns {void}
 */
function runPlan() {
  const { paths } = getDiffAndPaths(process.cwd())
  console.log(describeRequiredReviews(requiredReviews(paths)))
}

/**
 * Records the currently staged index's hash as the audit receipt, the
 * same way the pre-commit hook hashes it.
 * @returns {void}
 */
function runRecord() {
  const cwd = process.cwd()
  const { diff } = getDiffAndPaths(cwd)
  const hash = hashDiff(diff)
  writeFileSync(resolve(findGitDir(cwd), RECEIPT_NAME), `${hash}\n`)
  console.log(hash)
}

const command = process.argv[2]
if (command === 'plan') runPlan()
else if (command === 'record') runRecord()
else {
  process.stderr.write('Usage: node scripts/review-gate/cli.mjs <plan|record>\n')
  process.exit(1)
}
