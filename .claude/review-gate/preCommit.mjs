#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hashDiff, requiredReviews } from './lib/reviewScope.mjs'
import { buildReviewMessage, UNSTAGED_CHANGES_MESSAGE } from './lib/gateMessages.mjs'
import {
  findGitDir,
  getDiffAndPaths,
  hasUnstagedTrackedChanges,
  isMergeInProgress,
  RECEIPT_NAME
} from './lib/gitProcess.mjs'
import { runGateChecks } from './lib/gateChecks.mjs'

/**
 * Writes a message to stderr and returns the commit-blocking exit code.
 * @param {string} message - The reason the commit is blocked.
 * @returns {number} The process exit code.
 */
function block(message) {
  process.stderr.write(`${message}\n`)
  return 1
}

/**
 * Runs the gate as a real git pre-commit hook. Git invokes this at the
 * work tree's top with `GIT_INDEX_FILE` already pointed at the index
 * being committed, however the commit was started, so a plain
 * `git diff --cached` here always reads exactly what's about to land.
 * Concluding a merge is never gated, since every commit on the merged
 * branches already passed the gate on its own. Any other error blocks
 * the commit, since git aborts on any non-zero exit.
 * @returns {number} The process exit code.
 */
function main() {
  const cwd = process.cwd()

  try {
    if (isMergeInProgress(cwd)) return 0

    const { diff, paths } = getDiffAndPaths(cwd)
    if (diff.length === 0) return 0

    const reviews = requiredReviews(paths)
    if (reviews.length === 0) return 0

    const receiptPath = resolve(findGitDir(cwd), RECEIPT_NAME)
    const recordedHash = existsSync(receiptPath) ? readFileSync(receiptPath, 'utf8').trim() : null
    if (recordedHash !== hashDiff(diff)) return block(buildReviewMessage(reviews))

    if (hasUnstagedTrackedChanges(cwd)) return block(UNSTAGED_CHANGES_MESSAGE)

    const checkFailure = runGateChecks(cwd)
    if (checkFailure) return block(checkFailure)

    return 0
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return block(
      `Beekeeper pre-commit review gate: unexpected error, blocking to be safe: ${reason}`
    )
  }
}

process.exit(main())
