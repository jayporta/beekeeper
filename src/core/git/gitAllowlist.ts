const DIFF_FLAGS: ReadonlySet<string> = new Set([
  '--numstat',
  '-z',
  '--no-ext-diff',
  '--no-textconv',
  '--find-renames',
  '--ignore-submodules=dirty',
  '--'
])

/** Flags each allowlisted git subcommand may receive. Anything else is refused. */
const ALLOWED_OPTIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  'rev-parse': new Set([
    '--verify',
    '--quiet',
    '--end-of-options',
    '--path-format=absolute',
    '--git-common-dir',
    '--show-toplevel',
    '--symbolic-full-name'
  ]),
  'merge-base': new Set(),
  diff: DIFF_FLAGS,
  'diff-index': DIFF_FLAGS,
  'ls-files': new Set([
    '--others',
    '--exclude-standard',
    '--directory',
    '--no-empty-directory',
    '-z',
    '--'
  ]),
  'check-ref-format': new Set(),
  config: new Set()
}

/**
 * Refuses any git invocation outside the read-only surface Beekeeper uses.
 *
 * @remarks
 * The subcommand must be allowlisted. `config` is limited to the exact form
 * `config --get-regexp <pattern>`. Every other argument starting with `-`
 * must be in the subcommand's flag set (for example `diff --output=<path>`
 * writes a file, so it isn't). Arguments after `--` or `--end-of-options`
 * are operands and aren't inspected.
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
