import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { shortId, type SessionLabel } from '@renderer/features/sessions/sessionLabel'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import type { SessionDetailT } from './sessionDetailT'

/**
 * Names the viewed session. A session the list holds keeps its list label. One
 * it doesn't, because the list is still loading or lives in another folder, gets
 * a neutral placeholder and its short id, since nothing says it has no title.
 *
 * @param row - The session's row, or `null` when the list doesn't hold it.
 * @param ref - The viewed session.
 * @param t - The session detail translate function.
 * @returns The label.
 */
export function sessionDetailLabel(
  row: SessionRow | null,
  ref: SessionRefDto,
  t: SessionDetailT
): SessionLabel {
  return row?.label ?? { text: t('label.placeholder'), idHint: shortId(ref.sessionId) }
}
