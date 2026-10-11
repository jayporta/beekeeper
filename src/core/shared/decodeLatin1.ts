const CHUNK_BYTES = 8192

/**
 * Decodes bytes to a string of one character per byte, like
 * `Buffer#toString('latin1')`: byte `n` becomes U+00`n`.
 *
 * @remarks
 * Never use `TextDecoder('latin1')` here. The WHATWG label means windows-1252,
 * which maps bytes 0x80 to 0x9F to other characters in some hosts' decoders.
 * @param bytes - The bytes to decode.
 * @returns The decoded text, as long as `bytes`.
 */
export function decodeLatin1(bytes: Uint8Array): string {
  let text = ''
  for (let from = 0; from < bytes.length; from += CHUNK_BYTES) {
    text += String.fromCharCode(...bytes.subarray(from, from + CHUNK_BYTES))
  }
  return text
}
