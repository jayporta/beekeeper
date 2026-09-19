declare const projectDirNameBrand: unique symbol
declare const sessionIdBrand: unique symbol
declare const agentIdBrand: unique symbol

/**
 * A project's folder name exactly as it appears under `~/.claude/projects`.
 * Folder names are never decoded back into a filesystem path.
 */
export type ProjectDirName = string & { readonly [projectDirNameBrand]: true }

/**
 * The id of a session's transcript: its `.jsonl` filename without the
 * extension.
 */
export type SessionId = string & { readonly [sessionIdBrand]: true }

/**
 * The id of a subagent: the text between `agent-` and `.jsonl` in its
 * transcript filename, which is not always a hex string.
 */
export type AgentId = string & { readonly [agentIdBrand]: true }

/**
 * Brands a raw folder name as a {@link ProjectDirName}.
 * @param raw - The folder name exactly as it appears on disk.
 * @returns The branded project directory name.
 * @throws {Error} When `raw` is empty.
 */
export function toProjectDirName(raw: string): ProjectDirName {
  if (raw.length === 0) throw new Error('Project directory name cannot be empty')
  return raw as ProjectDirName
}

/**
 * Brands a raw filename stem as a {@link SessionId}.
 * @param raw - The session transcript's filename without its `.jsonl` extension.
 * @returns The branded session id.
 * @throws {Error} When `raw` is empty.
 */
export function toSessionId(raw: string): SessionId {
  if (raw.length === 0) throw new Error('Session id cannot be empty')
  return raw as SessionId
}

/**
 * Brands a raw filename fragment as an {@link AgentId}.
 * @param raw - The text between `agent-` and `.jsonl` in a subagent's transcript filename.
 * @returns The branded agent id.
 * @throws {Error} When `raw` is empty.
 */
export function toAgentId(raw: string): AgentId {
  if (raw.length === 0) throw new Error('Agent id cannot be empty')
  return raw as AgentId
}
