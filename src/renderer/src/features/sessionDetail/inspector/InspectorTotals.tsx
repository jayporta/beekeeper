import { useTranslation } from 'react-i18next'
import { formatTokens } from '@renderer/features/sessions/formatTokens'
import { InspectorCostNote } from './InspectorCostNote'
import { InspectorMarker } from './InspectorMarker'
import { InspectorNote } from './InspectorNote'
import { InspectorTotalsFrame } from './InspectorTotalsFrame'
import type { ReportCost } from './reportCost'
import type { Rollup } from './rollupBelow'

/** Props for {@link InspectorTotals}. */
interface InspectorTotalsProps {
  /** The agent's own tokens, or `null` when its report has none recorded. */
  readonly tokens: number | null
  /** The agent's cost at API prices. */
  readonly cost: ReportCost
  /** What the agents below add up to. */
  readonly rollup: Rollup
  /** Whether the agent's transcript had lines that couldn't be read, so its own figures may be low. */
  readonly unreadableLines: boolean
  /** Whether the session's subagents folder couldn't be read, so the agents below can't be counted. */
  readonly subagentsUnreadable: boolean
}

/**
 * The agent's totals: its own tokens in large type, then what it adds up to
 * with the agents below it (or that there are none), then its cost at API
 * prices. Tokens come first and cost follows. A figure that may be low carries
 * a "¹". The total with the agents below carries one when it may leave tokens
 * out: the agent's own were left out or may be low, an agent below is
 * partial, or a teammate below has subagents that aren't loaded. When the
 * subagents couldn't be read the note says so instead of saying there are
 * none, and carries one too.
 *
 * @example
 * <InspectorTotals tokens={1200} cost={{ usd: 0.4, partial: false }} rollup={rollup} unreadableLines={false} subagentsUnreadable={false} />
 */
export function InspectorTotals({
  tokens,
  cost,
  rollup,
  unreadableLines,
  subagentsUnreadable
}: InspectorTotalsProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { t: tSessions } = useTranslation('sessions')
  const noteMayBeLow =
    subagentsUnreadable ||
    (rollup.below > 0 &&
      (rollup.incomplete || rollup.subagentsNotLoaded || tokens === null || unreadableLines))
  const noAgentsBelow = subagentsUnreadable
    ? t('inspector.belowUnreadable')
    : t('inspector.noneBelow')

  return (
    <InspectorTotalsFrame tokens={tokens} partial={unreadableLines}>
      <InspectorNote>
        {rollup.below === 0
          ? noAgentsBelow
          : t('inspector.rollup', {
              tokens: formatTokens((tokens ?? 0) + rollup.tokens, tSessions),
              count: rollup.below
            })}
        {noteMayBeLow && <InspectorMarker />}
      </InspectorNote>
      <InspectorCostNote cost={cost} usageIncomplete={unreadableLines} />
    </InspectorTotalsFrame>
  )
}
