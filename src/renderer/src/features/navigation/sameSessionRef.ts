import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'

/**
 * Whether two refs name the same session. An absent ref matches only another
 * absent one.
 *
 * @param a - One ref, or `null`.
 * @param b - The other ref, or `null`.
 * @returns `true` when both are absent, or both name the same folder and session id.
 */
export function sameSessionRef(a: SessionRefDto | null, b: SessionRefDto | null): boolean {
  return a?.projectDirName === b?.projectDirName && a?.sessionId === b?.sessionId
}
