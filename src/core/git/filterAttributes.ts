import { err, ok, type Result } from '../shared/result'
import type { GitBinary } from './gitBinary'
import { runGit, type GitExecFn, type GitRunError } from './runGit'

/**
 * The most paths one `check-attr` call receives. Paths travel as arguments,
 * since `runGit` has no stdin, so batching keeps the command line far under
 * the operating system's argument limit however many files changed.
 */
export const CHECK_ATTR_BATCH_SIZE = 256

/**
 * The most changed paths {@link pathsAssignFilters} checks, which is 16
 * batches. The changed paths come from a diff that may list millions of
 * entries (a crafted repo fits about two million deleted files in the diff
 * output cap), and each batch is a git process run in turn, so past this many
 * the paths are not checked and the caller falls back to the committed-only
 * diff. Real sessions change a few hundred files at most.
 */
export const MAX_FILTER_CHECK_PATHS = 4096

/** Why the attributes of a set of paths could not be read. */
export type FilterAttributesError = GitRunError | 'git-failed'

/** One path's `filter` attribute as `git check-attr -z filter` reports it. */
export interface FilterAttribute {
  /** The path, as git reported it. */
  readonly path: string
  /** `unspecified`, `unset`, `set`, or the driver name a `filter=<name>` line assigned. */
  readonly value: string
}

/**
 * Splits paths into consecutive batches of at most `size`, in order.
 *
 * @param paths - The paths to split.
 * @param size - The most paths per batch, at least 1. Defaults to {@link CHECK_ATTR_BATCH_SIZE}.
 * @returns The batches; empty when there are no paths.
 */
export function batchPaths(
  paths: readonly string[],
  size: number = CHECK_ATTR_BATCH_SIZE
): string[][] {
  const batches: string[][] = []
  for (let start = 0; start < paths.length; start += size) {
    batches.push(paths.slice(start, start + size))
  }
  return batches
}

/**
 * Parses `git check-attr -z filter` output.
 *
 * @remarks
 * Each record is `path NUL attribute NUL value NUL`. Paths that aren't valid
 * UTF-8 are decoded with U+FFFD replacement characters.
 *
 * @param output - Raw bytes from git's stdout.
 * @returns The entries in order, or `malformed-check-attr` when the output
 * is not a whole number of records or names an attribute other than `filter`.
 */
export function parseFilterAttributes(
  output: Buffer
): Result<FilterAttribute[], 'malformed-check-attr'> {
  const fields = output.toString('utf-8').split('\0')
  if (fields.pop() !== '' || fields.length % 3 !== 0) return err('malformed-check-attr')

  const entries: FilterAttribute[] = []
  for (let index = 0; index < fields.length; index += 3) {
    const [path, attribute, value] = [fields[index], fields[index + 1], fields[index + 2]]
    if (path === undefined || value === undefined || attribute !== 'filter') {
      return err('malformed-check-attr')
    }
    entries.push({ path, value })
  }
  return ok(entries)
}

/**
 * Whether an attribute value names a filter. Only `unspecified` and `unset`
 * mean none: a driver name, and the bare `set`, both count.
 *
 * @param attribute - One parsed entry.
 * @returns `true` when the path has a filter attribute.
 */
export function assignsFilter(attribute: FilterAttribute): boolean {
  return attribute.value !== 'unspecified' && attribute.value !== 'unset'
}

/** Options for {@link pathsAssignFilters}. */
export interface PathsAssignFiltersOptions {
  /** The verified git executable. */
  readonly git: GitBinary
  /** The worktree whose attribute files apply, an absolute path. */
  readonly dir: string
  /** The changed paths to check, relative to `dir`. */
  readonly paths: readonly string[]
  /**
   * The most paths checked before giving up and reporting a filter.
   * @defaultValue {@link MAX_FILTER_CHECK_PATHS}
   */
  readonly maxPaths?: number
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
 * Asks `check-attr` in batches of {@link CHECK_ATTR_BATCH_SIZE}, stopping at
 * the first batch that finds one. No paths means no git call. More than
 * {@link MAX_FILTER_CHECK_PATHS} paths are not checked and count as assigned,
 * and so does a path with an invalid UTF-8 byte, which can't be passed back
 * to git faithfully: both leave the caller on the safe answer.
 *
 * @param options - The git binary, worktree, and changed paths.
 * @returns Whether a filter is assigned, or why git could not be asked.
 */
export async function pathsAssignFilters(
  options: PathsAssignFiltersOptions
): Promise<Result<boolean, FilterAttributesError>> {
  const { git, dir, paths, maxPaths = MAX_FILTER_CHECK_PATHS, exec } = options
  if (paths.length > maxPaths) return ok(true)
  if (paths.some((path) => path.includes('�'))) return ok(true)

  for (const batch of batchPaths(paths)) {
    const result = await runGit({
      git,
      dir,
      args: ['check-attr', '-z', 'filter', '--', ...batch],
      ...(exec === undefined ? {} : { exec })
    })
    if (!result.ok) return err(result.error)
    if (result.value.exitCode !== 0) return err('git-failed')
    const parsed = parseFilterAttributes(result.value.stdout)
    if (!parsed.ok) return err('git-failed')
    if (parsed.value.some(assignsFilter)) return ok(true)
  }
  return ok(false)
}
