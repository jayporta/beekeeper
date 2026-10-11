import { fileSystem } from '../io/installFileSystem'
import { NEWLINE_BYTE } from './readJsonlLines'
import type { TranscriptFileInfo } from './statTranscriptFile'

/** How many leading bytes of a file a {@link TailMark} keeps to recognize it again. */
export const TAIL_MARK_PREFIX_BYTES = 4096

/**
 * What a scan remembers about a transcript so a later read can tell the file
 * is still the same one, only longer: where it lives on disk and how it
 * begins.
 */
export interface TailMark {
  /** The inode of the file that was scanned. */
  readonly ino: number
  /** The device the file was on. */
  readonly dev: number
  /** The file's first bytes, up to {@link TAIL_MARK_PREFIX_BYTES}, or all of them for a shorter file. */
  readonly prefix: Uint8Array
}

/** Options for {@link confirmTailMark}. */
export interface ConfirmTailMarkOptions {
  /** The transcript as discovery stat'd it now. */
  readonly file: TranscriptFileInfo
  /** The mark taken when the transcript was last scanned. */
  readonly mark: TailMark
  /** The byte offset the last scan consumed through, which is where a line begins. */
  readonly offset: number
}

/** Reports whether two byte sequences hold the same bytes. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  return a.every((byte, index) => byte === b[index])
}

/** Reads the file's first {@link TAIL_MARK_PREFIX_BYTES} bytes, fewer for a shorter file. */
function readPrefix(path: string): Promise<Uint8Array> {
  return fileSystem().readRange(path, { position: 0, length: TAIL_MARK_PREFIX_BYTES })
}

/**
 * Takes the mark of a transcript about to be scanned from its start. Take it
 * before the scan reads, so a file rewritten in between fails the next
 * confirmation rather than slipping past it.
 *
 * @param file - The transcript, as discovery stat'd it.
 * @returns The file's identity and its first bytes.
 * @throws {Error} When the file cannot be opened or read, carrying the
 * system error code, as when it was deleted after discovery.
 */
export async function readTailMark(file: TranscriptFileInfo): Promise<TailMark> {
  const prefix = await readPrefix(file.path)
  return { ino: file.ino, dev: file.dev, prefix: new Uint8Array(prefix) }
}

/**
 * Decides whether a transcript is still the file a mark was taken from,
 * grown since. It must have the same inode and device, begin with the same
 * bytes, and still hold a newline just before the consumed offset, so a scan
 * that consumed whole lines can carry on from there. A transcript that fails
 * any of them was replaced, rewritten or cut, and has to be scanned again
 * from its start. An adapter that can't tell a file's identity reports `ino`
 * and `dev` as 0 on the file and the mark; they then match, and the prefix
 * and newline checks alone decide.
 *
 * @param options - The transcript, its earlier mark and the consumed offset.
 * @returns The mark to keep for the next confirmation, with the prefix
 * extended when the file has grown past what the earlier mark held, or `null`
 * when the scan cannot be carried on.
 * @throws {Error} When the file cannot be opened or read, carrying the
 * system error code.
 */
export async function confirmTailMark(options: ConfirmTailMarkOptions): Promise<TailMark | null> {
  const { file, mark, offset } = options
  if (file.ino !== mark.ino || file.dev !== mark.dev) return null

  const prefix = await readPrefix(file.path)
  const held = mark.prefix.byteLength
  if (prefix.byteLength < held || !bytesEqual(prefix.subarray(0, held), mark.prefix)) return null

  if (offset > 0) {
    const before =
      offset <= prefix.byteLength
        ? prefix.subarray(offset - 1, offset)
        : await fileSystem().readRange(file.path, { position: offset - 1, length: 1 })
    if (before[0] !== NEWLINE_BYTE) return null
  }

  return prefix.byteLength > held ? { ...mark, prefix: new Uint8Array(prefix) } : mark
}
