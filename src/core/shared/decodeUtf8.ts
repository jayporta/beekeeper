const DECODER = new TextDecoder('utf-8', { ignoreBOM: true })

/**
 * Decodes UTF-8 bytes to text the way `Buffer#toString('utf-8')` does: a
 * leading byte order mark is kept as U+FEFF and invalid sequences become
 * U+FFFD.
 * @param bytes - The bytes to decode.
 * @returns The decoded text.
 */
export function decodeUtf8(bytes: Uint8Array): string {
  return DECODER.decode(bytes)
}
