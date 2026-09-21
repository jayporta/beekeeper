import type { SubagentMetaErrorReason } from '../transcript/readSubagentMeta'
import type { SubagentMeta } from '../transcript/schemas'

/**
 * Why a subagent's meta couldn't be turned into usable data, beyond the
 * reasons {@link SubagentMetaErrorReason} covers: `unreadable` is an
 * unexpected read error (such as a permissions problem) captured rather
 * than thrown.
 */
export type SubagentMetaFailureReason = SubagentMetaErrorReason | 'unreadable'

/**
 * A subagent's resolved meta status, distinguishing "no meta file" from
 * "a meta file exists but couldn't be read or didn't validate", so the UI
 * can show the difference instead of treating both as silently absent.
 */
export type SubagentMetaStatus =
  | { readonly status: 'ok'; readonly meta: SubagentMeta }
  | { readonly status: 'absent' }
  | { readonly status: 'error'; readonly reason: SubagentMetaFailureReason }
