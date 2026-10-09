/**
 * The query key of the telemetry receiver's state. It is not one of the
 * persisted roots, so the bearer token the state holds never reaches IndexedDB.
 */
export const OTEL_RECEIVER_QUERY_KEY = ['otelReceiver'] as const
