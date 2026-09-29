import { lstat, readlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, sep } from 'node:path'
import { isAbsolutePathWithinCap } from '../shared/boundedPath'
import { errorCode } from '../shared/errorCode'
import { err, ok, type Result } from '../shared/result'
import { defaultFsRunner, isFsTimeout, type FsRunner } from './fsDeadline'
import { isInside } from './isInside'

/**
 * The most symbolic links {@link resolveInside} follows for one path. It
 * matches macOS's `MAXSYMLINKS`, so a chain the operating system would
 * resolve is resolved here too, while a cycle stops after a bounded number
 * of reads.
 */
export const MAX_LINK_HOPS = 32

/**
 * The most path components {@link resolveInside} processes for one path,
 * counting those the path names, those a link's target adds, and every `..`
 * step. The hop cap counts links only, and a `..` in a target costs no hop,
 * so this bounds the `lstat` calls a crafted chain of links can force. A real
 * path holds a few dozen components at most.
 */
export const MAX_WALK_STEPS = 1024

/**
 * The most milliseconds one {@link resolveInside} walk may take, checked before
 * each component. Each filesystem call has its own deadline, but a mount that
 * answers just inside it could otherwise keep a walk of many steps going for
 * as long as it likes.
 */
export const MAX_WALK_MS = 10_000

/**
 * Why {@link resolveInside} refused a path: `too-long` when it is not an
 * absolute path within the path cap; `escapes-root` when the path, or where a
 * link leads, is not inside the root; `dotdot` when the path itself has a `.`
 * or `..` component; `too-many-links` past {@link MAX_LINK_HOPS};
 * `too-many-steps` past {@link MAX_WALK_STEPS}; `not-found` when a component
 * is missing; `not-a-directory` when a component that is neither a directory
 * nor a link has more components after it, as the kernel's `ENOTDIR`;
 * `unreadable` for any other failure reading a component; and `timeout` when
 * reading a component hangs past its deadline, or the whole walk takes longer
 * than {@link MAX_WALK_MS}. A file as the last component is not refused.
 */
export type ResolveInsideError =
  | 'too-long'
  | 'escapes-root'
  | 'dotdot'
  | 'too-many-links'
  | 'too-many-steps'
  | 'not-found'
  | 'not-a-directory'
  | 'unreadable'
  | 'timeout'

/** Options for {@link resolveInside}. */
export interface ResolveInsideOptions {
  /** An absolute directory that is already a real path, with no symbolic link in it. */
  readonly root: string
  /** An absolute path that starts with `root`, as untrusted text. */
  readonly path: string
  /** Runs each `lstat` and `readlink` under a deadline. Defaults to the app-wide runner. */
  readonly fsRunner?: FsRunner
}

/** Splits path text into its non-empty components. */
function components(text: string): string[] {
  return text.split(sep).filter((component) => component !== '')
}

/**
 * Resolves an untrusted path that lies under a real directory, following
 * symbolic links by hand so that nothing outside that directory is ever
 * touched. `realpath` follows every link on the way before the result can be
 * checked, so a link inside the root that leads to a hung mount would stall
 * it. This walks the components below `root` one at a time with `lstat` and
 * `readlink`, and refuses a link the moment its target leaves `root`, before
 * reading anything past it.
 *
 * @remarks
 * A `path` that is not an absolute path within the path cap is refused
 * before it is split. A `.` or `..` component of `path` itself is refused,
 * since the kernel would resolve `..` through a link's target and the text
 * cannot. A `..` inside a link's relative target is followed against the
 * real directory the link sits in. An absolute link target is followed only
 * when it is textually inside `root` (its own `..` components refused); one
 * spelled through another link above `root` is refused even if it would land
 * inside.
 *
 * @param options - The real root and the untrusted path below it.
 * @returns The real path, inside `root`, or why the path was refused.
 */
export async function resolveInside(
  options: ResolveInsideOptions
): Promise<Result<string, ResolveInsideError>> {
  const { root, path } = options
  const run = options.fsRunner ?? defaultFsRunner
  if (!isAbsolutePathWithinCap(path)) return err('too-long')
  if (path === root) return ok(root)
  const prefix = root.endsWith(sep) ? root : root + sep
  if (!path.startsWith(prefix)) return err('escapes-root')

  const pending = components(path.slice(prefix.length))
  if (pending.some((component) => component === '.' || component === '..')) return err('dotdot')

  const startedAt = Date.now()
  let current = root
  let hops = 0
  let steps = 0
  for (let next = pending.shift(); next !== undefined; next = pending.shift()) {
    if (Date.now() - startedAt > MAX_WALK_MS) return err('timeout')
    steps += 1
    if (steps > MAX_WALK_STEPS) return err('too-many-steps')
    if (next === '.') continue
    if (next === '..') {
      current = dirname(current)
      if (!isInside(root, current)) return err('escapes-root')
      continue
    }

    const candidate = join(current, next)
    let target: string | undefined
    let isDirectory = false
    try {
      const stats = await run(() => lstat(candidate))
      isDirectory = stats.isDirectory()
      if (stats.isSymbolicLink()) target = await run(() => readlink(candidate))
    } catch (error) {
      if (isFsTimeout(error)) return err('timeout')
      const code = errorCode(error)
      return err(code === 'ENOENT' || code === 'ENOTDIR' ? 'not-found' : 'unreadable')
    }

    if (target === undefined) {
      // A file with components still to walk is where the kernel fails with ENOTDIR,
      // even when a later `..` would climb back out of it.
      if (!isDirectory && pending.length > 0) return err('not-a-directory')
      current = candidate
      continue
    }

    hops += 1
    if (hops > MAX_LINK_HOPS) return err('too-many-links')
    if (isAbsolute(target)) {
      const insideRoot = target === root || target.startsWith(prefix)
      if (!insideRoot || components(target).includes('..')) return err('escapes-root')
      pending.unshift(...components(target.slice(root.length)))
      current = root
    } else {
      pending.unshift(...components(target))
    }
  }
  return ok(current)
}
