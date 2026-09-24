import type { AgentReport } from '../../core/session/scanSession'
import type { TokenGroup } from '../../core/session/tokenGroup'
import type { AgentReportDto, PriceDto, TokenGroupDto } from '../../shared/ipc/agentDto'

function mapPrice(price: TokenGroup['price']): PriceDto {
  switch (price.kind) {
    case 'priced':
      return { kind: 'priced', usd: price.usd }
    case 'unpriced':
      return { kind: 'unpriced', reason: price.reason }
    case 'free':
      return { kind: 'free' }
  }
}

function mapTokenGroup(group: TokenGroup): TokenGroupDto {
  const { tokens } = group
  return {
    model: group.model,
    speed: group.speed,
    tokens: {
      input: tokens.input,
      output: tokens.output,
      cacheRead: tokens.cacheRead,
      cacheWrite5m: tokens.cacheWrite5m,
      cacheWrite1h: tokens.cacheWrite1h
    },
    price: mapPrice(group.price)
  }
}

/**
 * Maps one agent's scanned report onto its transfer shape.
 * @param report - The core report.
 * @returns The DTO, holding only the fields the renderer displays.
 */
export function mapAgentReport(report: AgentReport): AgentReportDto {
  return {
    tokenGroups: report.usage.tokenGroups.map(mapTokenGroup),
    messageCount: report.usage.messageCount,
    skippedLines: report.usage.skippedLines,
    fileTouches: report.fileTouches.map((touch) => ({
      filePath: touch.filePath,
      operation: touch.operation
    }))
  }
}
