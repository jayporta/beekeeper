const trailingBracketSuffix = /\[[^[\]]*\]$/
const trailingDateSuffix = /-\d{8}$/

/**
 * Normalizes a raw model id to the form used as a pricing table key, by
 * stripping a trailing bracketed suffix (e.g. `[1m]`) and a trailing
 * `-YYYYMMDD` date suffix, in either combination. Any other id, including
 * `<synthetic>`, passes through unchanged.
 * @param raw - The model id exactly as it appears in a transcript record.
 * @returns The normalized model id.
 */
export function normalizeModelId(raw: string): string {
  return raw.replace(trailingBracketSuffix, '').replace(trailingDateSuffix, '')
}
