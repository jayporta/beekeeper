// @ts-check
/**
 * What the Claude Code mod (`mod/`, built from `src/mod`) may do on the engine's `$`,
 * checked against `claude plugin validate --json` by `npm run check:mod`.
 *
 * Anything not listed is a violation. The mod never writes the environment, `$.store` or `$.state`,
 * and never reaches the network, a model, an MCP server, a prompt, a tool or another agent.
 * AGENTS.md, "What beekeeper is, and the promises it keeps", states the same limits.
 */
export const MOD_ALLOWLIST = Object.freeze({
  calls: Object.freeze([
    // The engine's version, for the minimum-version guard.
    '$.session.version',
    // Adds the /beekeeper slash command.
    '$.command.register',
    // Opens the beekeeper pane.
    '$.ui.open',
    // Looks up the elements a surface draws with.
    '$.ui.resolve',
    // Sets a fixed-text line in the status line when the mod can't start; it stays until replaced.
    '$.ui.status',
    // Reads one environment variable by literal name; the names are limited below.
    '$.env.get',
    // Reads session files (up to 4 MiB); the engine offers no write that shares this call.
    '$.fs.read',
    // Lists a directory.
    '$.fs.list',
    // Describes a path and resolves symlinks, so reads stay inside the projects folder.
    '$.fs.stat',
    // Runs git (checked against gitAllowlist.ts), the macOS git probes, and `uname -s`.
    '$.process.run',
    // Streams `tail -c` over a transcript larger than 4 MiB, confined to the projects folder.
    '$.process.spawn'
  ]),
  envReads: Object.freeze([
    // The home folder, for ~/.claude.
    'HOME',
    // Where Claude Code keeps its files when it is not ~/.claude.
    'CLAUDE_CONFIG_DIR',
    // The git repository variables: when any is set, the mod refuses to run git rather than let it
    // point at another repository.
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_COMMON_DIR',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_NAMESPACE',
    'GIT_ATTR_SOURCE',
    'GIT_REPLACE_REF_BASE'
  ])
})
