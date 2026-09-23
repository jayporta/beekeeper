declare const commitShaBrand: unique symbol

/** A full commit object name: 40 lowercase hex digits (SHA-1) or 64 (SHA-256). */
export type CommitSha = string & { readonly [commitShaBrand]: true }

const SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/

/**
 * Validates text as a full commit SHA.
 * @param text - Candidate text, already trimmed.
 * @returns The branded SHA, or `undefined` when `text` isn't 40 or 64 lowercase hex digits.
 */
export function parseCommitSha(text: string): CommitSha | undefined {
  return SHA_PATTERN.test(text) ? (text as CommitSha) : undefined
}
