/**
 * Why the telemetry receiver isn't listening though it was turned on:
 * `port-in-use` when another process holds its port, `failed` for anything
 * else. A raw system error code never reaches the renderer.
 */
export type OtelReceiverFailureDto = 'port-in-use' | 'failed'
