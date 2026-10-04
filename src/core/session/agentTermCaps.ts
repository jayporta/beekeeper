/** The most distinct subagent terms kept for one session. A real session has at most 43. */
export const MAX_AGENT_TERMS = 64

/**
 * The most UTF-16 code units kept across every field of one session's
 * subagent terms. A real session's terms take at most about 2000.
 */
export const MAX_AGENT_TERM_CODE_UNITS = 4096
