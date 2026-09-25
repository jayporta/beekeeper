#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hashDiff, requiredReviews } from './lib/reviewScope.mjs'
import { findGitDir, getDiffAndPaths, RECEIPT_NAME } from './lib/gitProcess.mjs'
import { describeRequiredReviews } from './lib/gateMessages.mjs'
import { installHooks } from './installHooks.mjs'

/**
 * Installs the git hook and reports the outcome, exiting non-zero when the
 * review gate did not end up on.
 * @returns {void}
 */
function runInstall() {
  const { ok, messages } = installHooks()
  const write = ok ? console.log : console.error
  for (const message of messages) write(message)
  if (!ok) process.exitCode = 1
}

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
if (command === 'install') runInstall()
else if (command === 'plan') runPlan()
else if (command === 'record') runRecord()
else {
  process.stderr.write('Usage: node .claude/review-gate/cli.mjs install | plan | record\n')
  process.exit(1)
}
