/**
 * Hashes a Bash command so two calls can be compared without keeping the text.
 * FNV-1a, 32-bit, over UTF-16 code units.
 *
 * @param command - The command text.
 * @returns An unsigned 32-bit hash.
 */
export function commandHash(command: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < command.length; index += 1) {
    hash ^= command.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
