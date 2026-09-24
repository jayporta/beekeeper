import { resolve, sep } from 'node:path'

/**
 * Whether `path` is `root` or lies beneath it, judged by the path text alone.
 * @param root - An absolute directory.
 * @param path - An absolute path, possibly untrusted.
 * @returns `true` when `path` equals `root` or continues past a separator after it.
 */
export function isInside(root: string, path: string): boolean {
  const base = resolve(root)
  const target = resolve(path)
  return target === base || target.startsWith(base.endsWith(sep) ? base : base + sep)
}
