import { describe, expect, it } from 'vitest'
import { telemetryEnvLines } from '../telemetryEnvLines'
import { MAX_COPY_TEXT_LENGTH } from '../../../../../shared/ipc/requestSchemas'

describe('telemetryEnvLines', () => {
  it('lists the variables that point Claude Code at the receiver', () => {
    expect(telemetryEnvLines({ port: 23456, token: 'abc-DEF_123' })).toBe(
      [
        'export CLAUDE_CODE_ENABLE_TELEMETRY=1',
        'export OTEL_LOGS_EXPORTER=otlp',
        'export OTEL_EXPORTER_OTLP_LOGS_PROTOCOL=http/json',
        'export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://127.0.0.1:23456/v1/logs',
        'export OTEL_EXPORTER_OTLP_LOGS_HEADERS="Authorization=Bearer abc-DEF_123"'
      ].join('\n')
    )
  })

  it('uses the port it is given', () => {
    expect(telemetryEnvLines({ port: 5000, token: 't' })).toContain('http://127.0.0.1:5000/v1/logs')
  })

  it('stays within the length the copy call accepts, for a real token', () => {
    const token = 'x'.repeat(43)

    expect(telemetryEnvLines({ port: 23456, token }).length).toBeLessThanOrEqual(
      MAX_COPY_TEXT_LENGTH
    )
  })
})
