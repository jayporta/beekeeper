import type { UsageFigures } from '../../../../shared/sessions/sessionUsage'

/**
 * Whether a card has any usage figure to show.
 *
 * @param figures - The card's figures, or `null` for none.
 * @returns `true` when tokens or cost is known, which also narrows `figures` to not `null`.
 */
export function hasUsage(figures: UsageFigures | null): figures is UsageFigures {
  return figures !== null && (figures.tokens !== null || figures.usd !== null)
}
