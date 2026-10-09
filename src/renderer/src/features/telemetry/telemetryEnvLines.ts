/** What {@link telemetryEnvLines} needs. */
interface TelemetryEnvOptions {
  /** The loopback port the receiver listens on. */
  readonly port: number
  /** The bearer token Claude Code must send. */
  readonly token: string
}

/**
 * The shell lines that point Claude Code's OpenTelemetry log export at the
 * receiver: JSON over HTTP to the loopback endpoint, with the bearer token as
 * its `Authorization` header. The header is quoted because its value holds a
 * space.
 *
 * @param options - The receiver's port and token.
 * @returns The lines, one `export` per variable, joined by newlines.
 */
export function telemetryEnvLines({ port, token }: TelemetryEnvOptions): string {
  return [
    'export CLAUDE_CODE_ENABLE_TELEMETRY=1',
    'export OTEL_LOGS_EXPORTER=otlp',
    'export OTEL_EXPORTER_OTLP_LOGS_PROTOCOL=http/json',
    `export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://127.0.0.1:${port}/v1/logs`,
    `export OTEL_EXPORTER_OTLP_LOGS_HEADERS="Authorization=Bearer ${token}"`
  ].join('\n')
}
