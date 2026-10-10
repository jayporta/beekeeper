import { appendFileSync, writeFileSync } from 'node:fs'
import type { TranscriptFileInfo } from './statTranscriptFile'
import { BASE_SECONDS, touchFile } from './testFileTimes'
import { statWrittenTranscript } from './testStatTranscript'

/** A transcript file that a test writes a little at a time, as a live session does. */
export interface GrowingTranscript {
  /** The file's absolute path. */
  readonly path: string
  /** How many bytes of the script are in the file. */
  written(): number
  /**
   * Appends the next slice of the script, between one byte and the step
   * limit long, then moves the file's modification time forward, so a stat
   * always tells it from the one before.
   * @returns Whether anything was appended, which is false once the whole script is in.
   */
  grow(): boolean
  /**
   * Appends the script up to a byte count, with the same modification time
   * step as {@link GrowingTranscript.grow}.
   * @param end - How many bytes of the script the file should hold; a count the file already holds appends nothing.
   */
  growTo(end: number): void
  /** The file as discovery would stat it now. */
  stat(): Promise<TranscriptFileInfo>
}

/** Options for {@link createGrowingTranscript}. */
export interface GrowingTranscriptOptions {
  /** Where to create the file. */
  readonly path: string
  /** The bytes the file grows into. */
  readonly script: Buffer
  /** Seeds the sequence of slice lengths, so a failing run can be repeated. */
  readonly seed: number
  /** The longest slice one `grow` appends, in bytes. */
  readonly maxStep: number
}

/**
 * A small seeded generator (mulberry32), so a failing run can be repeated.
 * @param seed - The generator's starting state.
 * @returns A function that returns the next number in `[0, 1)` on each call.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Creates an empty transcript file that grows into `script` in slices of
 * random length, so appends land mid-line and inside multi-byte characters.
 * Each growth moves the file's modification time one second on from
 * {@link BASE_SECONDS}.
 *
 * @param options - The file, the script, and the slice lengths.
 * @returns The growing transcript.
 */
export function createGrowingTranscript(options: GrowingTranscriptOptions): GrowingTranscript {
  const { path, script, maxStep } = options
  const random = seededRandom(options.seed)
  let written = 0
  let steps = 0
  writeFileSync(path, '')

  function growTo(end: number): void {
    const target = Math.min(end, script.length)
    if (target <= written) return
    appendFileSync(path, script.subarray(written, target))
    written = target
    steps += 1
    touchFile(path, BASE_SECONDS + steps)
  }

  return {
    path,
    written: () => written,
    grow() {
      if (written >= script.length) return false
      growTo(written + 1 + Math.floor(random() * maxStep))
      return true
    },
    growTo,
    stat: () => statWrittenTranscript(path)
  }
}
