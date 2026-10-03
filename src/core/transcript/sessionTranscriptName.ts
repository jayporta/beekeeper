/** A session transcript's filename: a lowercase UUID followed by `.jsonl`. */
export const SESSION_TRANSCRIPT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/

/** The extension that follows a session id in a transcript's filename. */
export const SESSION_TRANSCRIPT_SUFFIX = '.jsonl'
