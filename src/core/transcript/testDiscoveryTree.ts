import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * A compact spec for a synthetic filesystem tree, used to set up discovery
 * tests without touching a real `~/.claude` directory.
 */
export interface DiscoveryTreeSpec {
  /** Relative file paths mapped to the synthetic content to write. */
  readonly files?: Record<string, string>
  /**
   * Relative symlink paths mapped to their target, passed to `fs.symlink`
   * exactly as given: relative to the link's own directory, or absolute.
   */
  readonly symlinks?: Record<string, string>
}

/** A synthetic filesystem tree built for one test, and how to remove it. */
export interface DiscoveryTree {
  /** The tree's root directory, created fresh under the OS temp directory. */
  readonly root: string
  /** Removes the tree and everything under it. */
  readonly cleanup: () => Promise<void>
}

/**
 * Builds a small, synthetic filesystem tree from a {@link DiscoveryTreeSpec}
 * under a fresh temp directory, for testing project and session discovery.
 *
 * @param spec - The files and symlinks to create.
 * @returns The tree's root path and a `cleanup` function that removes it.
 */
export async function buildDiscoveryTree(spec: DiscoveryTreeSpec): Promise<DiscoveryTree> {
  const root = await mkdtemp(join(tmpdir(), 'beekeeper-discovery-'))

  for (const [relativePath, content] of Object.entries(spec.files ?? {})) {
    const filePath = join(root, relativePath)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf-8')
  }

  for (const [relativePath, target] of Object.entries(spec.symlinks ?? {})) {
    const linkPath = join(root, relativePath)
    await mkdir(dirname(linkPath), { recursive: true })
    await symlink(target, linkPath)
  }

  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}
