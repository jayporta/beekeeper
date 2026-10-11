const STRICT_DECODER = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

/**
 * Whether bytes are well-formed UTF-8, like `isUtf8` from `node:buffer`. A
 * leading byte order mark counts as valid text.
 * @param bytes - The bytes to check.
 * @returns `true` when every sequence is valid; `true` for empty input.
 */
export function isUtf8Bytes(bytes: Uint8Array): boolean {
  try {
    STRICT_DECODER.decode(bytes)
    return true
  } catch (error) {
    if (error instanceof TypeError) return false
    throw error
  }
}
