import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'

/** A class of tokens, by how the API bills it. The cache write is both its 5-minute and 1-hour windows. */
export type TokenClass = 'input' | 'output' | 'cacheRead' | 'cacheWrite'

/** One class's total in a token breakdown. */
export interface TokenClassTotal {
  /** The class. */
  readonly tokenClass: TokenClass
  /** The tokens of that class across every model, speed and report. */
  readonly tokens: number
}

/**
 * Splits the tokens of one or more agents by class, in the order input,
 * output, cache read, cache write.
 *
 * @param reports - The agents' reports.
 * @returns The four classes, each `0` when no report holds any.
 */
export function tokenClasses(reports: readonly AgentReportDto[]): readonly TokenClassTotal[] {
  const totals: Record<TokenClass, number> = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  for (const report of reports) {
    for (const { tokens } of report.tokenGroups) {
      totals.input += tokens.input
      totals.output += tokens.output
      totals.cacheRead += tokens.cacheRead
      totals.cacheWrite += tokens.cacheWrite5m + tokens.cacheWrite1h
    }
  }
  const classes = ['input', 'output', 'cacheRead', 'cacheWrite'] as const
  return classes.map((tokenClass) => ({ tokenClass, tokens: totals[tokenClass] }))
}
