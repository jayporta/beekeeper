import type {
  AgentMetaDto,
  AgentMetaStatusDto,
  AgentNodeDto,
  AgentReportDto,
  TokenGroupDto
} from '../../../../shared/ipc/agentDto'
import type { SessionDetailDto } from '../../../../shared/ipc/sessionDetailDto'
import type { WorkflowRunDto } from '../../../../shared/ipc/workflowRunDto'

/** An agent report with no usage, files, or flags, unless overridden. */
export function testReport(overrides: Partial<AgentReportDto> = {}): AgentReportDto {
  return {
    tokenGroups: [],
    messageCount: 0,
    skippedLines: 0,
    fileTouches: [],
    fileListIncomplete: false,
    activity: null,
    ...overrides
  }
}

/** A token group on one model, with `input` and `output` tokens and any other class overridden. */
export function testTokenGroup(
  tokens: Partial<TokenGroupDto['tokens']> = {},
  model = 'claude-sonnet-5'
): TokenGroupDto {
  return {
    model,
    speed: 'standard',
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, ...tokens },
    price: { kind: 'free' }
  }
}

/** A readable meta, with the agent type `Explore` unless overridden. */
export function testMeta(overrides: Partial<AgentMetaDto> = {}): AgentMetaStatusDto {
  return { status: 'ok', meta: { agentType: 'Explore', ...overrides } }
}

/** The options of {@link testNode}. */
interface TestNodeOptions {
  /** The agent's meta. Defaults to a readable `Explore` meta, or an absent one for the lead. */
  readonly meta?: AgentMetaStatusDto
  /** The agents it spawned. Defaults to none. */
  readonly children?: readonly AgentNodeDto[]
  /** The workflow run the agent ran in. Defaults to none. */
  readonly workflowRunId?: string
}

/** One node of the agent tree: a subagent when given an id, the lead otherwise. */
export function testNode(agentId: string | null, options: TestNodeOptions = {}): AgentNodeDto {
  const {
    meta = agentId === null ? { status: 'absent' } : testMeta(),
    children = [],
    workflowRunId = null
  } = options
  return { agentId, meta, workflowRunId, children }
}

/** The options of {@link testDetail}. */
interface TestDetailOptions {
  /** The lead's report. Defaults to {@link testReport}. */
  readonly lead?: AgentReportDto
  /** The subagents hanging off the lead. Defaults to none. */
  readonly children?: readonly AgentNodeDto[]
  /** Each subagent's report by id, or `false` for an unreadable subagents folder. Missing ids get a default report. */
  readonly reports?: Readonly<Record<string, AgentReportDto | 'error'>> | false
  /** The session's workflow runs. Defaults to none. */
  readonly workflowRuns?: readonly WorkflowRunDto[]
}

/** A session detail with the given subagents and reports. */
export function testDetail(options: TestDetailOptions = {}): SessionDetailDto {
  const { lead = testReport(), children = [], reports = {}, workflowRuns = [] } = options
  const ids: string[] = []
  const pending = [...children]
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (node.agentId !== null) ids.push(node.agentId)
    pending.push(...node.children)
  }
  return {
    sessionId: '11111111-1111-4111-8111-111111111111',
    tree: testNode(null, { children }),
    lead,
    subagents:
      reports === false
        ? { ok: false, error: { code: 'unreadable' } }
        : {
            ok: true,
            value: ids.map((agentId) => {
              const report = reports[agentId] ?? testReport()
              return {
                agentId,
                report:
                  report === 'error'
                    ? { ok: false, error: { code: 'unreadable' } }
                    : { ok: true, value: report }
              }
            })
          },
    reconciliation: {
      models: [],
      totals: { transcriptUSD: null, transcriptPartial: false, recordedUSD: null }
    },
    workflowRuns
  }
}
