import { toProjectDirName, toSessionId } from '../transcript/ids'
import type { SessionRole } from '../transcript/sessionRole'
import type { AgentSignals } from '../transcript/signals/agentSignals'
import type {
  ActivitySpan,
  RecordedUsage,
  SessionSummary
} from '../transcript/summary/sessionSummary'
import { buildSessionSummary, EMPTY_SIGNALS } from '../transcript/summary/testSessionSummary'
import type { TeammateSpawn, TeammateStop, TranscriptTeamSpawns } from '../transcript/teammateSpawn'
import type { SessionRef, SummarizedSession } from './teamGrouping'

/** Builds a {@link SessionRef} from plain strings, for test fixtures. */
export function testRef(projectDirName: string, sessionId: string): SessionRef {
  return { projectDirName: toProjectDirName(projectDirName), sessionId: toSessionId(sessionId) }
}

/** Builds an {@link ActivitySpan} from plain numbers, for test fixtures. */
export function testActivity(earliestMs: number, latestMs: number): ActivitySpan {
  return { earliestMs, latestMs }
}

/** Builds a {@link RecordedUsage} with the given totals, for test fixtures. */
export function testUsage(
  totalUSD: number | null,
  totalTokens: number | null = null
): RecordedUsage {
  return { totalUSD, totalTokens }
}

/** Builds a {@link TeammateSpawn}, for test fixtures. */
export function testSpawn(agentName: string, teamName: string | null): TeammateSpawn {
  return { agentName, teamName, agentType: null, rawToolUseId: null }
}

/** Builds a {@link TeammateStop}, for test fixtures. */
export function testStop(agentName: string, teamName: string | null): TeammateStop {
  return { agentName, teamName }
}

/** Builds {@link TranscriptTeamSpawns} from spawns and stops, for test fixtures. */
export function testTeamSpawns(
  spawns: readonly TeammateSpawn[] = [],
  stops: readonly TeammateStop[] = []
): TranscriptTeamSpawns {
  return { spawns, stops, truncated: false }
}

/** Options accepted by {@link testLead} and {@link testAgent}. */
interface TestSessionOptions {
  /** The session's activity span. Defaults to `null`. */
  readonly activity?: ActivitySpan | null
  /** The teammates this session's own transcript spawned and stopped. Defaults to none. */
  readonly teamSpawns?: TranscriptTeamSpawns
  /** What the session recorded about its own usage. Defaults to `null`, no record. */
  readonly usage?: RecordedUsage | null
  /** The session's signals. Defaults to all zero. */
  readonly signals?: AgentSignals
}

function testSession(
  identity: { readonly ref: SessionRef; readonly role: SessionRole },
  options: TestSessionOptions
): SummarizedSession {
  const summary: SessionSummary = buildSessionSummary({
    usage: options.usage ?? null,
    activity: options.activity ?? null,
    role: identity.role,
    teamSpawns: options.teamSpawns ?? testTeamSpawns(),
    signals: options.signals ?? EMPTY_SIGNALS
  })
  return { ref: identity.ref, summary }
}

/** Builds a lead-role {@link SummarizedSession}, for test fixtures. */
export function testLead(ref: SessionRef, options: TestSessionOptions = {}): SummarizedSession {
  return testSession({ ref, role: { kind: 'lead' } }, options)
}

/** Options accepted by {@link testAgent}: the session options plus the agent's own name, team and type. */
interface TestAgentOptions extends TestSessionOptions {
  /** The agent's own name, or `null` when it has none. */
  readonly agentName: string | null
  /** The agent's team, or `null` when it has none. */
  readonly teamName: string | null
  /** The agent's type. Defaults to `null`. */
  readonly agentType?: string | null
}

/** Builds an agent-role {@link SummarizedSession}, for test fixtures. */
export function testAgent(ref: SessionRef, options: TestAgentOptions): SummarizedSession {
  return testSession(
    {
      ref,
      role: {
        kind: 'agent',
        agentName: options.agentName,
        teamName: options.teamName,
        agentType: options.agentType ?? null
      }
    },
    options
  )
}
