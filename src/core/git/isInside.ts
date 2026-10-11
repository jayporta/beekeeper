import { fileSystem } from '../io/installFileSystem'
import { PATH_SEPARATOR } from '../shared/absolutePath'

/**
 * Whether `path` is `root` or lies beneath it, judged by the path text alone.
 * @param root - An absolute directory.
 * @param path - An absolute path, possibly untrusted.
 * @returns `true` when `path` equals `root` or continues past a separator after it.
 */
export function isInside(root: string, path: string): boolean {
  const fs = fileSystem()
  const base = fs.resolvePath(root)
  const target = fs.resolvePath(path)
  return (
    target === base ||
    target.startsWith(base.endsWith(PATH_SEPARATOR) ? base : base + PATH_SEPARATOR)
  )
}
