/**
 * How long the refresh status stays empty before its message is set, in
 * milliseconds. Some screen reader and browser pairs miss text that arrives in
 * the same tick as the live region, and a message that clears and returns
 * within a frame can merge into no announcement. The wait makes each message
 * its own change.
 */
export const STATUS_ANNOUNCE_DELAY_MS = 100
