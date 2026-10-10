import type { AgentSignalsDto } from '../../../../shared/ipc/agentDto'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../shared/ipc/emptyAgentSignals'
import type {
  AgentSearchTermDto,
  SessionListItemDto,
  SessionSummaryDto
} from '../../../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import type { SessionRoleDto } from '../../../../shared/ipc/sessionRoleDto'
import type { SessionTeamDto, TeamUsageRollupDto } from '../../../../shared/ipc/sessionTeamDto'

/** Options for {@link testSession}. */
interface TestSessionOptions {
  /** The session's folder. Defaults to `-p`. */
  readonly projectDirName?: string
  /** The session's title. Defaults to `null`. */
  readonly title?: string | null
  /** The session's role. Defaults to a lead. */
  readonly role?: SessionRoleDto
  /** The session's team entry. Defaults to `null`. */
  readonly team?: SessionTeamDto | null
  /** The last record timestamp. Defaults to none. */
  readonly latestMs?: number
  /** The first record timestamp. Defaults to `latestMs`. */
  readonly earliestMs?: number
  /** The transcript's modified time. Defaults to `null`. */
  readonly modifiedMs?: number | null
  /** The model. Defaults to `null`. */
  readonly model?: string | null
  /** The recorded cost. Defaults to none. */
  readonly costUSD?: number | null
  /** The recorded token total. Defaults to none. */
  readonly totalTokens?: number | null
  /** The tokens the transcript reports. Defaults to `null`. */
  readonly transcriptTokens?: number | null
  /** How many subagent transcripts the session has, or `null` when unknown. Defaults to `0`. */
  readonly subagentCount?: number | null
  /** The session's workflow counts. Defaults to none, or `null` when `subagentCount` is `null`. */
  readonly workflows?: SessionListItemDto['workflows']
  /** What a search matches on for each subagent. Defaults to none. */
  readonly agentTerms?: readonly AgentSearchTermDto[]
  /** The names of the session's workflow runs. Defaults to none. */
  readonly workflowRunNames?: readonly string[]
  /** How many transcript lines could not be read. Defaults to `0`. */
  readonly skippedLines?: number
  /** The plan limit the session hit. Defaults to `null`. */
  readonly limitHit?: SessionSummaryDto['limitHit']
  /** The session's own signal counts. Defaults to all zero. */
  readonly signals?: AgentSignalsDto
  /** Whether the summary could not be read. Defaults to `false`. */
  readonly unreadable?: boolean
  /** Whether the item is an archived copy. Defaults to `false`. */
  readonly archived?: boolean
}

/** The id of the `n`th test session: a UUID whose first group is `n` padded to 8 digits. */
export function testSessionId(n: number): string {
  return `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`
}

/** Builds a synthetic session list item. */
export function testSession(n: number, options: TestSessionOptions = {}): SessionListItemDto {
  const {
    projectDirName = '-p',
    title = null,
    role = { kind: 'lead' },
    team = null,
    latestMs,
    earliestMs = latestMs,
    modifiedMs = null,
    model = null,
    costUSD,
    totalTokens,
    transcriptTokens = null,
    subagentCount = 0,
    workflows = subagentCount === null ? null : { runs: 0, agents: 0 },
    agentTerms = [],
    workflowRunNames = [],
    skippedLines = 0,
    limitHit = null,
    signals = EMPTY_AGENT_SIGNALS_DTO,
    unreadable = false,
    archived = false
  } = options

  const summary: SessionSummaryDto = {
    title,
    usage:
      costUSD === undefined && totalTokens === undefined
        ? null
        : { totalUSD: costUSD ?? null, totalTokens: totalTokens ?? null },
    activity: latestMs === undefined || earliestMs === undefined ? null : { earliestMs, latestMs },
    skippedLines,
    role,
    model,
    limitHit,
    transcriptTokens,
    signals
  }
  return {
    projectDirName,
    sessionId: testSessionId(n),
    modifiedMs,
    sizeBytes: 1,
    subagentCount,
    workflows,
    agentTerms,
    workflowRunNames,
    summary: unreadable
      ? { ok: false, error: { code: 'unreadable' } }
      : { ok: true, value: summary },
    team,
    archived
  }
}

/** A team usage roll-up with nothing missing, for a lead. */
export function testUsage(overrides: Partial<TeamUsageRollupDto> = {}): TeamUsageRollupDto {
  return {
    leadUSD: 1,
    teamUSD: 3,
    leadTokens: 100,
    teamTokens: 300,
    sessionsWithoutCost: 0,
    sessionsWithoutTokens: 0,
    missingTeammates: 0,
    teamListsTruncated: false,
    signalTotals: { toolErrors: 0, compactions: 0, agentsKilled: 0, partial: false },
    ...overrides
  }
}

/** A reference to the `n`th test session. */
export function testRef(n: number, projectDirName = '-p'): SessionRefDto {
  return { projectDirName, sessionId: testSessionId(n) }
}

/** A lead team entry whose teammates are the given sessions. */
export function testLeadTeam(
  teammates: readonly SessionRefDto[],
  usage: TeamUsageRollupDto = testUsage()
): SessionTeamDto {
  return { kind: 'lead', teammates, usage }
}

/** A teammate team entry pointing at the given lead. */
export function testTeammateTeam(lead: SessionRefDto, stopped = false): SessionTeamDto {
  return { kind: 'teammate', lead, joinedBy: 'spawn', stopped }
}

/** An agent role. */
export function testAgentRole(agentName: string | null, agentType: string | null): SessionRoleDto {
  return { kind: 'agent', agentName, agentType, teamName: 'team' }
}
