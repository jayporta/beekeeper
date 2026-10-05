import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'

/** A class of tokens, by how the API bills it. The cache write is both its 5-minute and 1-hour windows. */
export type TokenClass = 'input' | 'output' | 'cacheRead' | 'cacheWrite'

/** One class's row in the token breakdown. */
export interface TokenRow {
  /** The class. */
  readonly tokenClass: TokenClass
  /** The tokens of that class across every model and speed. */
  readonly tokens: number
  /** The tokens as a fraction of the largest class, from 0 to 1, for the row's bar. */
  readonly fraction: number
}

/**
 * Splits an agent's tokens by class, in the order input, output, cache read,
 * cache write, each with its size against the largest of the four.
 *
 * @param report - The agent's report.
 * @returns The four rows.
 */
export function tokenBreakdown(report: AgentReportDto): readonly TokenRow[] {
  const totals: Record<TokenClass, number> = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  for (const { tokens } of report.tokenGroups) {
    totals.input += tokens.input
    totals.output += tokens.output
    totals.cacheRead += tokens.cacheRead
    totals.cacheWrite += tokens.cacheWrite5m + tokens.cacheWrite1h
  }
  const largest = Math.max(...Object.values(totals))
  const classes = ['input', 'output', 'cacheRead', 'cacheWrite'] as const
  return classes.map((tokenClass) => ({
    tokenClass,
    tokens: totals[tokenClass],
    fraction: largest === 0 ? 0 : totals[tokenClass] / largest
  }))
}
