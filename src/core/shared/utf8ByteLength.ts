const ENCODER = new TextEncoder()

/**
 * Counts the bytes of a string's UTF-8 encoding, like `Buffer.byteLength`. A
 * lone surrogate counts as U+FFFD (3 bytes).
 * @param text - The text to measure.
 * @returns The byte length.
 */
export function utf8ByteLength(text: string): number {
  return ENCODER.encode(text).length
}
