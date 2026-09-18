const REVIEW_LABELS = {
  'code-review': 'code review',
  security: 'security',
  accessibility: 'accessibility'
}

const REVIEW_AGENT_NAMES = {
  'code-review': 'code-reviewer',
  security: 'security-reviewer',
  accessibility: 'a11y-reviewer'
}

/** Blocks a commit while tracked files have unstaged changes. */
export const UNSTAGED_CHANGES_MESSAGE =
  "Unstaged changes: the checks would run against different content than what's being committed. Stage or stash them first."

/**
 * Describes which reviews a diff needs, naming the review types and
 * offering the project's default reviewer agents as defaults rather than
 * requirements, since a contributor may use their own equivalents.
 * @param {string[]} reviews - Required review categories, from `requiredReviews`.
 * @returns {string} A one-line description, or "none (docs-only)" when nothing is required.
 */
export function describeRequiredReviews(reviews) {
  if (reviews.length === 0) return 'none (docs-only)'

  const labels = reviews.map((review) => REVIEW_LABELS[review]).join(', ')
  const agents = reviews.map((review) => REVIEW_AGENT_NAMES[review]).join(', ')
  return `Required reviews: ${labels} (defaults: ${agents} in .claude/agents/, or your own equivalents).`
}

/**
 * Builds the message that blocks a commit pending review.
 * @param {string[]} reviews - Required review categories for the blocked diff.
 * @returns {string} The block message.
 */
export function buildReviewMessage(reviews) {
  return [
    'Beekeeper pre-commit review gate: an audit is required before this commit.',
    '',
    describeRequiredReviews(reviews),
    'Fix every finding and re-run until all report clean.',
    'Commit exactly the staged index you recorded (a plain git commit, not -a or a pathspec).',
    '',
    'Then record the reviewed diff:',
    '  npm run review:record'
  ].join('\n')
}
