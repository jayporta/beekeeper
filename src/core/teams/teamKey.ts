import type { SessionRole } from '../transcript/sessionRole'

/**
 * Folds a label into a case- and normalization-insensitive comparison
 * form: NFKC-normalizes, lowercases, then strips combining marks after
 * decomposing to NFD. Labels that differ only in case, compatibility
 * form or accents fold alike, so "Café", "café" and "cafe" match, and a
 * label made only of combining marks folds to the empty string.
 * Cross-script homoglyphs are not folded, since that needs Unicode
 * confusables data; a team name is never an authenticity signal.
 * @param label - A team or agent name as a session or spawn recorded it.
 * @returns The folded key.
 */
export function foldLabel(label: string): string {
  return label.normalize('NFKC').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

/**
 * Folds a (team, name) pair into the key spawns are matched by.
 * @param teamName - A team name as a session or spawn recorded it.
 * @param agentName - An agent name as a session or spawn recorded it.
 * @returns The folded key, its two parts joined by a NUL that neither can
 * contain, so they can never collide across the boundary.
 */
export function foldTeamKey(teamName: string, agentName: string): string {
  return `${foldLabel(teamName)}\0${foldLabel(agentName)}`
}

/**
 * Folds a session's own role into its (team, name) pair key.
 * @param role - A session's role.
 * @returns The key {@link foldTeamKey} gives its team and name, or `null`
 * for a lead role or an agent role missing either name.
 */
export function agentPairKey(role: SessionRole): string | null {
  if (role.kind !== 'agent' || role.teamName === null || role.agentName === null) return null
  return foldTeamKey(role.teamName, role.agentName)
}
