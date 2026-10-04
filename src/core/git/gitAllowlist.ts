/**
 * Flags every diff-like read passes: numeric line counts, NUL-separated
 * records, no external diff or textconv hooks, rename detection, and a
 * submodule's uncommitted edits ignored so only its recorded commit shows.
 */
export const DIFF_ARGS: readonly string[] = [
  '--numstat',
  '-z',
  '--no-ext-diff',
  '--no-textconv',
  '--find-renames',
  '--ignore-submodules=dirty'
]

/**
 * Flags a patch read passes: the changed files as NUL-separated raw records,
 * then the unified patch, uncolored, with three lines of context and fixed
 * path prefixes. They carry the same no-hook and rename flags as
 * {@link DIFF_ARGS}. The prefix, color, context, and submodule flags pin what a
 * repository's own config could otherwise change in the text: the submodule
 * one keeps a changed submodule to its two recorded commits, so no submodule
 * history or contents are read.
 */
export const PATCH_ARGS: readonly string[] = [
  '--raw',
  '-z',
  '--patch',
  '--no-color',
  '--unified=3',
  '--no-ext-diff',
  '--no-textconv',
  '--find-renames',
  '--ignore-submodules=dirty',
  '--submodule=short',
  '--src-prefix=a/',
  '--dst-prefix=b/'
]

/**
 * Flags `ls-files` passes to list untracked paths outside ignore rules, one
 * NUL-separated entry per file or directory.
 */
export const UNTRACKED_ARGS: readonly string[] = [
  '--others',
  '--exclude-standard',
  '--directory',
  '--no-empty-directory',
  '-z'
]

const DIFF_FLAGS: ReadonlySet<string> = new Set([...DIFF_ARGS, ...PATCH_ARGS, '--'])
const UNTRACKED_FLAGS: ReadonlySet<string> = new Set([...UNTRACKED_ARGS, '--'])

/**
 * The only flags `check-attr` may receive: NUL-separated output, every
 * attribute rather than one named, and the separator before the paths.
 * `-a`, `--stdin`, and `--source` stay refused, so it reads the paths named on
 * the command line from the worktree's own attribute files.
 */
const CHECK_ATTR_FLAGS: ReadonlySet<string> = new Set(['-z', '--all', '--'])

/** Flags each allowlisted git subcommand may receive. Anything else is refused. */
const ALLOWED_OPTIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  'rev-parse': new Set([
    '--verify',
    '--quiet',
    '--end-of-options',
    '--path-format=absolute',
    '--git-common-dir',
    '--show-toplevel',
    '--absolute-git-dir',
    '--symbolic-full-name'
  ]),
  'merge-base': new Set(),
  diff: DIFF_FLAGS,
  'diff-index': DIFF_FLAGS,
  'ls-files': UNTRACKED_FLAGS,
  'check-ref-format': new Set(),
  config: new Set(),
  'check-attr': CHECK_ATTR_FLAGS
}

/**
 * Refuses any git invocation outside the read-only surface Beekeeper uses.
 *
 * @remarks
 * The subcommand must be allowlisted. `config` is limited to the exact form
 * `config --get-regexp <pattern>`. Every other argument starting with `-`
 * must be in the subcommand's flag set (for example `diff --output=<path>`
 * writes a file, so it isn't). `check-attr` takes `-z`, `--all`, and `--`
 * only. Arguments after `--` or `--end-of-options` are operands and aren't
 * inspected.
 *
 * @param args - The subcommand followed by its arguments.
 * @throws {Error} With message `git-subcommand-not-allowed` or `git-option-not-allowed`.
 */
export function assertAllowedGitArgs(args: readonly string[]): void {
  const [subcommand, ...rest] = args
  const allowed = subcommand === undefined ? undefined : ALLOWED_OPTIONS[subcommand]
  if (subcommand === undefined || allowed === undefined) {
    throw new Error('git-subcommand-not-allowed')
  }
  if (subcommand === 'config') {
    if (args.length !== 3 || args[1] !== '--get-regexp') {
      throw new Error('git-subcommand-not-allowed')
    }
    return
  }
  for (const arg of rest) {
    if (arg === '--' || arg === '--end-of-options') {
      if (!allowed.has(arg)) throw new Error('git-option-not-allowed')
      return
    }
    if (arg.startsWith('-') && !allowed.has(arg)) throw new Error('git-option-not-allowed')
  }
}
