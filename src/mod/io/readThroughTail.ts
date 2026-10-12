import { isInside } from '../../core/git/isInside'
import type { ModHost } from '../modHost'
import { portError } from './toPortError'

/** What {@link readThroughTail} needs to stream a file. */
export interface ReadThroughTailOptions {
  /** What the mod may ask of the engine. */
  host: ModHost
  /** The real path of the projects folder; the file must land under it. */
  projectsRoot: string
  /** Where the file lands, from the engine's stat of it; undefined when the engine reported none. */
  realPath: string | undefined
  /** The byte offset to start at. */
  start: number
}

/**
 * Streams a file `$.fs.read` can't return, from a byte offset, by running `tail` on it.
 *
 * The file's real path must lie under `projectsRoot`, which is checked before anything is spawned,
 * and `tail` runs on that real path, so a link swapped in afterwards doesn't move it. Stopping
 * early ends the child.
 *
 * Bytes come back as re-encoded UTF-8 text. Exact for valid UTF-8, which Claude Code writes. An
 * invalid byte comes back as U+FFFD (3 bytes) and shifts later offsets.
 *
 * @param options - The host, the projects folder, the file's real path, and where to start.
 * @returns The file's bytes in order.
 * @throws {Error} With code `EACCES` when the file lands outside the projects folder, or `EIO` when
 * `tail` fails.
 */
export async function* readThroughTail(
  options: ReadThroughTailOptions
): AsyncGenerator<Uint8Array, void> {
  const { host, projectsRoot, realPath, start } = options
  if (realPath === undefined || !isInside(projectsRoot, realPath)) {
    throw portError('EACCES', 'outside the projects folder')
  }

  const encoder = new TextEncoder()
  const tail = host.tail(realPath, start)
  try {
    for (;;) {
      const step = await tail.next()
      if (step.done) {
        if (step.value.code !== 0) throw portError('EIO')
        return
      }
      if (step.value.stream === 'stdout') yield encoder.encode(step.value.text)
    }
  } finally {
    await tail.return({ code: null, signal: null })
  }
}
