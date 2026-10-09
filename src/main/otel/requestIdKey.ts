import { createHash } from 'node:crypto'

/**
 * Reduces a request id to 52 bits of its SHA-256, a number that is exact in a
 * double. A set of these takes far less memory than a set of the ids, which
 * may be hundreds of characters.
 *
 * @remarks
 * Two ids can share a key, and then the second counts as a repeat of the
 * first. With at most a few thousand ids per session the chance of any
 * collision is about one in a billion, and its cost is one request left out of
 * a cross-check figure, so it is accepted.
 *
 * @param requestId - A request id from a log record.
 * @returns A non-negative integer below 2^52.
 */
export function requestIdKey(requestId: string): number {
  const digest = createHash('sha256').update(requestId).digest()
  // 48 bits from six bytes, then the top four bits of the seventh.
  return digest.readUIntBE(0, 6) * 16 + (digest.readUInt8(6) >> 4)
}
