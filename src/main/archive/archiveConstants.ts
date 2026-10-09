/** Milliseconds in a day. */
export const DAY_MS = 86_400_000

/** The version of the DTO JSON stored in the archive. A row at another version is rewritten, never read. */
export const ARCHIVE_FORMAT = 1

/** The most characters of detail JSON the archive stores for one session. A longer detail is skipped. */
export const MAX_ARCHIVED_DETAIL_CHARS = 5_000_000

/** How many days a session must be quiet before its detail is archived, so a running session isn't rescanned repeatedly. */
export const ARCHIVE_DETAIL_AFTER_DAYS = 7

/** How long, in milliseconds, after the archiver starts before its first pass. */
export const ARCHIVE_PASS_DELAY_MS = 60_000

/** How long, in milliseconds, after a pass ends before the next one starts. */
export const ARCHIVE_PASS_INTERVAL_MS = DAY_MS
