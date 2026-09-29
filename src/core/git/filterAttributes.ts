import { err, ok, type Result } from '../shared/result'
import type { GitBinary } from './gitBinary'
import { runGit, type GitExecFn, type GitRunError } from './runGit'

/**
 * The most paths one `check-attr` call receives. Paths travel as arguments,
 * since `runGit` has no stdin, so batching keeps the command line short however
 * many files changed. Together with {@link CHECK_ATTR_BATCH_BYTES} it keeps each
 * command line far under macOS's 1 MiB `ARG_MAX` and Linux's 128 KiB floor.
 */
export const CHECK_ATTR_BATCH_SIZE = 256

/**
 * The most bytes of paths one `check-attr` call receives, where a path costs
 * its UTF-8 length plus one for its argument terminator. 64 KiB keeps each
 * command line far under macOS's 1 MiB `ARG_MAX` and Linux's 128 KiB floor,
 * with room for the fixed arguments.
 */
export const CHECK_ATTR_BATCH_BYTES = 64 * 1024

/**
 * The most `check-attr` batches {@link pathsAssignFilters} runs. The changed
 * paths come from a diff that may list millions of entries (a crafted repo
 * fits about two million deleted files in the diff output cap), and each batch
 * is a git process run in turn, so past this many the paths are not checked
 * and the caller falls back to the committed-only diff. Real sessions change a
 * few hundred files at most.
 */
export const MAX_CHECK_ATTR_BATCHES = 16

/**
 * The most output one `check-attr --all` batch may print, which fits 32
 * attributes for every path in a full batch. `--all` output grows with the
 * attributes a `.gitattributes` assigns, so a crafted file could otherwise
 * send `runGit`'s full buffer for every batch. Overflowing counts as assigned.
 */
export const CHECK_ATTR_MAX_OUTPUT = 2 * 1024 * 1024

/** Why the attributes of a set of paths could not be read. */
export type FilterAttributesError = GitRunError | 'git-failed'

/** One path's `filter` attribute as `git check-attr -z --all` reports it. */
export interface FilterAttribute {
  /** The path, as git reported it. */
  readonly path: string
  /** `set`, `unset`, `unspecified`, or the driver name a `filter=<name>` line assigned. */
  readonly value: string
}

/** Limits for {@link batchPaths}. */
export interface BatchLimits {
  /**
   * The most paths per batch, at least 1.
   * @defaultValue {@link CHECK_ATTR_BATCH_SIZE}
   */
  readonly size?: number
  /**
   * The most bytes per batch, counting each path as its UTF-8 length plus one.
   * A single path over the budget still gets a batch of its own.
   * @defaultValue {@link CHECK_ATTR_BATCH_BYTES}
   */
  readonly bytes?: number
}

/** What a path adds to a command line: its UTF-8 bytes and a terminator. */
function argumentCost(path: string): number {
  return Buffer.byteLength(path) + 1
}

/**
 * Splits paths into consecutive batches, in order, each within both limits.
 *
 * @param paths - The paths to split.
 * @param limits - The most paths and bytes per batch.
 * @returns The batches; empty when there are no paths.
 */
export function batchPaths(paths: readonly string[], limits: BatchLimits = {}): string[][] {
  const { size = CHECK_ATTR_BATCH_SIZE, bytes = CHECK_ATTR_BATCH_BYTES } = limits
  const batches: string[][] = []
  let current: string[] = []
  let currentBytes = 0
  for (const path of paths) {
    const cost = argumentCost(path)
    if (current.length > 0 && (current.length >= size || currentBytes + cost > bytes)) {
      batches.push(current)
      current = []
      currentBytes = 0
    }
    current.push(path)
    currentBytes += cost
  }
  if (current.length > 0) batches.push(current)
  return batches
}

/**
 * Parses `git check-attr -z --all` output into the `filter` records.
 *
 * @remarks
 * Each record is `path NUL attribute NUL value NUL`. Records for other
 * attributes (`text`, `diff`, macros) are skipped. `--all` prints no record for
 * an unspecified attribute, so any `filter` record at all means the path has
 * one assigned, including `-filter` (`unset`), which git prints exactly as it
 * prints `filter=unset`. Paths that aren't valid UTF-8 are decoded with U+FFFD
 * replacement characters.
 *
 * @param output - Raw bytes from git's stdout.
 * @returns The `filter` entries in order, or `malformed-check-attr` when the output
 * is not a whole number of records.
 */
export function parseFilterAttributes(
  output: Buffer
): Result<FilterAttribute[], 'malformed-check-attr'> {
  const fields = output.toString('utf-8').split('\0')
  if (fields.pop() !== '' || fields.length % 3 !== 0) return err('malformed-check-attr')

  const entries: FilterAttribute[] = []
  for (let index = 0; index < fields.length; index += 3) {
    const [path, attribute, value] = [fields[index], fields[index + 1], fields[index + 2]]
    if (path === undefined || attribute === undefined || value === undefined) {
      return err('malformed-check-attr')
    }
    if (attribute === 'filter') entries.push({ path, value })
  }
  return ok(entries)
}

/** Options for {@link pathsAssignFilters}. */
export interface PathsAssignFiltersOptions {
  /** The verified git executable. */
  readonly git: GitBinary
  /** The worktree whose attribute files apply, an absolute path. */
  readonly dir: string
  /** The changed paths to check, relative to `dir`, each valid UTF-8. */
  readonly paths: readonly string[]
  /**
   * The most batches checked before giving up and reporting a filter.
   * @defaultValue {@link MAX_CHECK_ATTR_BATCHES}
   */
  readonly maxBatches?: number
  /** Runs git in place of `execFile`, for tests. */
  readonly exec?: GitExecFn
}

/**
 * Whether any of the paths has a `filter` attribute, which a working-tree
 * diff would apply through a driver the repo's own config may not define here
 * (an LFS repo defines its driver in global config, which is disabled), so the
 * files would read as spurious changes.
 *
 * @remarks
 * Asks `check-attr --all` in batches within {@link CHECK_ATTR_BATCH_SIZE} paths
 * and {@link CHECK_ATTR_BATCH_BYTES} bytes, stopping at the first batch that
 * finds one. No paths means no git call. Asking for every attribute is what
 * tells an unassigned filter apart from `filter=unspecified`, since git prints
 * `unspecified` for both when asked for `filter` by name.
 *
 * Three cases count as assigned without an answer from git, which leaves the
 * caller on the safe committed-only answer: a single path over the byte budget,
 * more than `maxBatches` batches, and a batch whose output overflows
 * {@link CHECK_ATTR_MAX_OUTPUT}. `--all` output is unbounded on a crafted
 * `.gitattributes` (one pattern can assign thousands of attributes to every
 * path), and an overflow means the attributes were too large to be an ordinary
 * setup.
 *
 * @param options - The git binary, worktree, and changed paths.
 * @returns Whether a filter is assigned, or why git could not be asked.
 */
export async function pathsAssignFilters(
  options: PathsAssignFiltersOptions
): Promise<Result<boolean, FilterAttributesError>> {
  const { git, dir, paths, maxBatches = MAX_CHECK_ATTR_BATCHES, exec } = options
  if (paths.length > maxBatches * CHECK_ATTR_BATCH_SIZE) return ok(true)
  if (paths.some((path) => argumentCost(path) > CHECK_ATTR_BATCH_BYTES)) return ok(true)
  const batches = batchPaths(paths)
  if (batches.length > maxBatches) return ok(true)

  for (const batch of batches) {
    const result = await runGit({
      git,
      dir,
      args: ['check-attr', '-z', '--all', '--', ...batch],
      maxBuffer: CHECK_ATTR_MAX_OUTPUT,
      ...(exec === undefined ? {} : { exec })
    })
    if (!result.ok) return result.error === 'output-too-large' ? ok(true) : err(result.error)
    if (result.value.exitCode !== 0) return err('git-failed')
    const parsed = parseFilterAttributes(result.value.stdout)
    if (!parsed.ok) return err('git-failed')
    if (parsed.value.length > 0) return ok(true)
  }
  return ok(false)
}
