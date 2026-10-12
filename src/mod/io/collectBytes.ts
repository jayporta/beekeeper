/**
 * Gathers chunks into one array, and stops pulling once it has enough.
 *
 * @param chunks - The chunks in order. Stopping returns the iterator, which ends its source.
 * @param atLeast - How many bytes to collect before stopping; `Infinity` collects them all.
 * @returns The bytes collected: at least `atLeast` unless the chunks ran out first. The last chunk
 * is kept whole, so there can be more.
 */
export async function collectBytes(
  chunks: AsyncIterable<Uint8Array>,
  atLeast: number
): Promise<Uint8Array> {
  const parts: Uint8Array[] = []
  let total = 0
  if (atLeast > 0) {
    for await (const chunk of chunks) {
      parts.push(chunk)
      total += chunk.length
      if (total >= atLeast) break
    }
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }
  return bytes
}
