import type { AgentSignalsDto } from '../../../../../shared/ipc/agentDto'
import { formatDuration } from '@renderer/features/sessions/formatDuration'
import type { SessionsT } from '@renderer/features/sessions/sessionsT'
import type { SessionDetailT } from '../sessionDetailT'

/** The shortest run of one Bash command that counts as a repeat. */
const MIN_REPEAT = 2

/** What {@link signalRows} reads. */
interface SignalRowsInput {
  /** The agent's signal counts. */
  readonly signals: AgentSignalsDto
  /** Whether to include the agents killed row, which only an agent in a session of its own can have. */
  readonly showKills: boolean
  /** The sessions translate function, which supplies the duration pattern. */
  readonly tSessions: SessionsT
}

/** One row of the inspector's Signals section. */
export interface SignalRow {
  /** A stable key for the row. */
  readonly key: 'toolErrors' | 'bashRepeat' | 'compactions' | 'agentsKilled' | 'longestWait'
  /** The row's term. */
  readonly label: string
  /** The row's figure, as text. */
  readonly value: string
}

/**
 * The rows of an agent's Signals section: what each count says in words.
 *
 * @param input - The signals, whether to show agent kills, and the sessions translate function.
 * @param t - The session detail translate function.
 * @returns The rows in display order.
 */
export function signalRows(
  { signals, showKills, tSessions }: SignalRowsInput,
  t: SessionDetailT
): readonly SignalRow[] {
  const count = (value: number): string => t('inspector.signals.count', { count: value })
  const { toolErrors, longestToolWait } = signals

  const errors =
    toolErrors === 0
      ? count(0)
      : t('inspector.signals.errorsWithStreak', {
          count: toolErrors,
          streak: t('inspector.signals.streak', { count: signals.longestErrorStreak })
        })

  const wait =
    longestToolWait === null
      ? t('inspector.signals.none')
      : t('inspector.signals.waitValue', {
          duration: formatDuration(longestToolWait.ms, tSessions),
          tool: longestToolWait.tool
        })

  const rows: SignalRow[] = [
    { key: 'toolErrors', label: t('inspector.signals.toolErrors'), value: errors },
    {
      key: 'bashRepeat',
      label: t('inspector.signals.bashRepeat'),
      value:
        signals.longestBashRepeat < MIN_REPEAT
          ? t('inspector.signals.noRepeats')
          : count(signals.longestBashRepeat)
    },
    {
      key: 'compactions',
      label: t('inspector.signals.compactions'),
      value: count(signals.compactions)
    }
  ]
  if (showKills) {
    rows.push({
      key: 'agentsKilled',
      label: t('inspector.signals.agentsKilled'),
      value: count(signals.agentsKilled)
    })
  }
  rows.push({ key: 'longestWait', label: t('inspector.signals.longestWait'), value: wait })
  return rows
}
