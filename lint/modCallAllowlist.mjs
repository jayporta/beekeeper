// @ts-check
/**
 * What the Claude Code mod (`mod/`, built from `src/mod`) may do on the engine's `$`,
 * checked against `claude plugin validate --json` by `npm run check:mod`.
 *
 * Anything not listed is a violation. The mod never writes the environment or `$.store`, writes
 * `$.state` only under its own `beekeeper` keys, and never reaches the network, a model, an MCP
 * server, a prompt, a tool or another agent.
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
    // Reads this session's id, to find its transcript.
    '$.session.id',
    // Reads this session's working directory, to prefer its project folder.
    '$.session.root',
    // The time, to stamp a refresh.
    '$.clock.now',
    // Runs one refresh later: the open, and the debounce after a turn, a spawn or a /clear.
    '$.clock.after',
    // Drives the 10 s and 30 s refresh ticks while the pane is open.
    '$.clock.every',
    // Tells whether the pane is open, so ticks and refreshes stop when it closes.
    '$.ui.panes',
    // Reads the mod's own state while drawing, which redraws the pane when it changes.
    '$.state.get',
    // Stores the pane's view under the mod's own `beekeeper.view` key; the mod never reads another plugin's value.
    '$.state.set',
    // Describes a path and resolves symlinks, so reads stay inside the projects folder.
    '$.fs.stat',
    // Runs git (checked against gitAllowlist.ts), the macOS git probes, and `uname -s`.
    '$.process.run',
    // Streams `tail -c` over a transcript larger than 4 MiB, confined to the projects folder.
    '$.process.spawn'
  ]),
  // The mod's own `$.state` values, declared in mod/types/index.d.ts; never another plugin's.
  stateReads: Object.freeze([
    'beekeeper.view',
    'beekeeper.selected',
    // Which screen the pane shows; read by the refresher to pick its target.
    'beekeeper.nav',
    // The Browse screen's data, read while drawing.
    'beekeeper.browse',
    // The selected agent's worktree diff, read while drawing.
    'beekeeper.diffs',
    // The worktree patch a press asked for, read while drawing and by the refresher.
    'beekeeper.patch'
  ]),
  stateWrites: Object.freeze([
    'beekeeper.view',
    'beekeeper.selected',
    // Written only by the pane's press handlers.
    'beekeeper.nav',
    // Written by the refresher with the Browse screen's data.
    'beekeeper.browse',
    // Written by the refresher with the selected agent's worktree diff.
    'beekeeper.diffs',
    // Written by the press handlers and by the refresher with the patch.
    'beekeeper.patch'
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
