/**
 * Joins byte arrays end to end into a new array.
 * @param parts - The arrays to join, in order.
 * @returns A new array holding every part's bytes.
 */
export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    joined.set(part, offset)
    offset += part.length
  }
  return joined
}
