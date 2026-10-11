/**
 * Finds the first occurrence of a byte sequence, like `Buffer#indexOf` with a
 * buffer argument.
 * @param haystack - The bytes to search.
 * @param needle - The bytes to find. An empty needle matches at `from`.
 * @param from - Where to start looking. Defaults to 0.
 * @returns The index of the first match at or after `from`, or -1.
 */
export function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  const first = needle[0]
  if (first === undefined) return Math.min(from, haystack.length)
  const last = haystack.length - needle.length
  for (
    let at = haystack.indexOf(first, from);
    at !== -1 && at <= last;
    at = haystack.indexOf(first, at + 1)
  ) {
    let matches = true
    for (let offset = 1; offset < needle.length; offset += 1) {
      if (haystack[at + offset] !== needle[offset]) {
        matches = false
        break
      }
    }
    if (matches) return at
  }
  return -1
}
