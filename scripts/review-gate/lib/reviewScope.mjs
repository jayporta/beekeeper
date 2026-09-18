import { createHash } from 'node:crypto'
import {
  isAccessibilityPath,
  isDocsPath,
  isSecurityPath,
  isTestPath
} from './pathClassification.mjs'

const REVIEW_ORDER = ['code-review', 'security', 'accessibility']

/**
 * Decides which reviews a diff needs, from its changed paths. A test
 * path never triggers security or accessibility on its own, so a
 * test-only diff needs only a code review.
 * @param {string[]} paths - Paths changed by the diff, relative to the repo root.
 * @returns {string[]} The required reviews, an ordered subset of `['code-review', 'security', 'accessibility']`.
 */
export function requiredReviews(paths) {
  const needed = new Set()

  for (const path of paths) {
    if (!isDocsPath(path)) needed.add('code-review')
    if (isTestPath(path)) continue
    if (isSecurityPath(path)) needed.add('security')
    if (isAccessibilityPath(path)) needed.add('accessibility')
  }

  return REVIEW_ORDER.filter((review) => needed.has(review))
}

/**
 * Hashes a diff's exact bytes with SHA-256. The diff is expected to be
 * the output of
 * `git diff --cached --binary --no-ext-diff --no-textconv --no-color`,
 * so the pre-commit hook and `npm run review:record` always hash the
 * same bytes for the same index.
 * @param {string | Buffer} diffText - The diff's contents, as text or raw bytes.
 * @returns {string} The hex-encoded digest.
 */
export function hashDiff(diffText) {
  const bytes = Buffer.isBuffer(diffText) ? diffText : Buffer.from(diffText, 'utf8')
  return createHash('sha256').update(bytes).digest('hex')
}
