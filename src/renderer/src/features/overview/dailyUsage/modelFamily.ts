/** A group of models the chart treats as one series. */
export type ModelFamily = 'fable' | 'opus' | 'sonnet' | 'haiku' | 'other'

/** Every family, in the order the chart stacks them and the legend lists them. */
export const FAMILIES = [
  'fable',
  'opus',
  'sonnet',
  'haiku',
  'other'
] as const satisfies readonly ModelFamily[]

/** The families a model id can name, each with the pattern that finds its name as a whole word. */
const NAMED_FAMILIES = FAMILIES.filter((family) => family !== 'other').map(
  (family) => [family, new RegExp(`(?<![a-z0-9])${family}(?![a-z0-9])`, 'i')] as const
)

/**
 * The family a model id belongs to: the one it names as a whole word between
 * separators (`claude-3-5-sonnet-20241022`, `us.anthropic.claude-haiku-4-5`),
 * ignoring case, else `other`.
 *
 * @param modelId - A model id. Transcript-derived: only matched, never rendered.
 * @returns The model's family.
 */
export function modelFamily(modelId: string): ModelFamily {
  return NAMED_FAMILIES.find(([, pattern]) => pattern.test(modelId))?.[0] ?? 'other'
}
