import type { SessionRole } from '../../core/transcript/sessionRole'
import type { SessionRoleDto } from '../../shared/ipc/sessionRoleDto'

/**
 * Maps a session role to its DTO field by field, so no unknown fields cross
 * the bridge.
 *
 * @param role - The role a summary scan classified.
 * @returns The role as sent to the renderer.
 */
export function mapSessionRole(role: SessionRole): SessionRoleDto {
  if (role.kind === 'lead') return { kind: 'lead' }
  return {
    kind: 'agent',
    agentType: role.agentType,
    agentName: role.agentName,
    teamName: role.teamName
  }
}
