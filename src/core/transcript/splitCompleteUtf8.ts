/** A chunk split at the last complete UTF-8 character. */
export interface Utf8Split {
  /** The bytes that end on a character boundary. */
  readonly complete: Uint8Array
  /** A trailing lead byte and its continuation bytes, 0 to 3 bytes, never holding `\n`. */
  readonly rest: Uint8Array
}

/** The most continuation bytes a UTF-8 character has, which bounds how far back a lead byte can sit. */
const MAX_CONTINUATION_BYTES = 3

/** Whether `byte` is a UTF-8 continuation byte (0x80 to 0xBF). */
function isContinuation(byte: number): boolean {
  return byte >= 0x80 && byte <= 0xbf
}

/** How many bytes the character starting with lead byte `byte` (0xC0 to 0xF7) takes. */
function characterLength(byte: number): number {
  if (byte >= 0xf0) return 4
  if (byte >= 0xe0) return 3
  return 2
}

/**
 * Splits `bytes` so `complete` never ends inside a multi-byte UTF-8
 * character. Only a trailing lead byte (0xC0 to 0xF7) followed by fewer
 * continuation bytes (0x80 to 0xBF) than it announces is carried; anything
 * else, invalid bytes included, stays in `complete` and decodes as U+FFFD,
 * as a streaming decoder would.
 *
 * Lets a reader decode chunk by chunk without `TextDecoder`'s
 * `{ stream: true }` option, which not every runtime honors.
 *
 * @param bytes - A chunk of UTF-8 bytes, possibly cut mid-character.
 * @returns The decodable part, and the incomplete tail (a copy) to put in
 * front of the next chunk.
 */
export function splitCompleteUtf8(bytes: Uint8Array): Utf8Split {
  const lowest = Math.max(0, bytes.length - 1 - MAX_CONTINUATION_BYTES)
  for (let index = bytes.length - 1; index >= lowest; index--) {
    const byte = bytes[index]
    if (byte === undefined || isContinuation(byte)) continue
    if (byte >= 0xc0 && byte <= 0xf7 && bytes.length - index < characterLength(byte)) {
      return { complete: bytes.subarray(0, index), rest: new Uint8Array(bytes.subarray(index)) }
    }
    break
  }
  return { complete: bytes, rest: new Uint8Array(0) }
}
