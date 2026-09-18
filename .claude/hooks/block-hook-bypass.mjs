#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BYPASS_SUBSTRINGS = ['--no-v', 'hookspath', '--no-hooks']
const SHORT_N_FLAG = /(^|[\s"'=])-[a-z]*n[a-z]*(?=[\s"'=]|$)/i
const COMMIT_TREE = /\bcommit-tree\b/i
const CHMOD = /\bchmod\b/i
const GITHOOKS_PATH = /\.githooks/i
const GLOBAL_OPTION_WITH_VALUE = /^-[Cc]$|^--(git-dir|work-tree)$/

/**
 * Checks whether `am` is the git subcommand of any git invocation in
 * `command`: the first non-option token after a `git` (or `.../git`) token, once global
 * options like `-C <path>`, `-c <key>=<value>`, `--git-dir`, and
 * `--work-tree` are skipped. A simple whitespace split, not a full
 * parser, so exotic quoting can produce a false negative; that's fine
 * for a speed bump.
 * @param {string} command - The raw Bash command.
 * @returns {boolean} Whether `am` is the git subcommand.
 */
function isGitAmSubcommand(command) {
  const tokens = command.split(/\s+/)
  return tokens.some(
    (token, index) =>
      /(^|\/)git$/i.test(token) && /^am$/i.test(subcommandAfter(tokens, index) ?? '')
  )
}

/**
 * Finds the subcommand following the git token at `gitIndex`.
 * @param {string[]} tokens - The whitespace-split command.
 * @param {number} gitIndex - Index of a `git` token.
 * @returns {string | undefined} The subcommand token, if any.
 */
function subcommandAfter(tokens, gitIndex) {
  let i = gitIndex + 1
  while (i < tokens.length) {
    const token = tokens[i] ?? ''
    if (GLOBAL_OPTION_WITH_VALUE.test(token)) i += 2
    else if (token.startsWith('-')) i += 1
    else break
  }
  return tokens[i]
}

/**
 * Checks whether a Bash command looks like it might bypass the git
 * pre-commit review hook: an abbreviated `--no-verify` (git accepts any
 * unambiguous prefix), anything mentioning `hooksPath`, `--no-hooks`,
 * `am` or `commit-tree` as the git subcommand (git never runs the hook
 * for either), a `chmod` touching `.githooks`, or a `commit` invocation
 * carrying a short flag cluster that includes `n` (e.g. `-n`, `-nm`,
 * `-nm'x'`, git's own no-verify shorthand), bounded by whitespace, a
 * quote, or `=`. Matching is case-insensitive. This is a coarse
 * heuristic for agents, not a parser; false positives are fine.
 * @param {string} command - The raw Bash command.
 * @returns {boolean} Whether the command should be blocked.
 */
export function looksLikeHookBypass(command) {
  const lower = command.toLowerCase()
  if (BYPASS_SUBSTRINGS.some((needle) => lower.includes(needle))) return true
  if (isGitAmSubcommand(command) || COMMIT_TREE.test(command)) return true
  if (CHMOD.test(command) && GITHOOKS_PATH.test(command)) return true
  return /\bcommit\b/i.test(command) && SHORT_N_FLAG.test(command)
}

function readCommand() {
  try {
    const payload = JSON.parse(readFileSync(0, 'utf8'))
    return typeof payload?.tool_input?.command === 'string' ? payload.tool_input.command : null
  } catch {
    return null
  }
}

// Only act as the hook when run directly, not when a test imports the
// pure predicate above, since reading stdin would otherwise hang that.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = readCommand()
  if (command !== null && looksLikeHookBypass(command)) {
    process.stderr.write(
      'Blocked: this command looks like it might bypass the pre-commit review hook. Use a plain git commit and let it run.\n'
    )
    process.exit(2)
  }
}
