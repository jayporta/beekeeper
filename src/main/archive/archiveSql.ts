/** The archive store's SQL statements. */

/** Only the small columns, so the large text ones are never read. */
export const SELECT_STATES = `
SELECT project_dir, session_id, source_mtime_ms, source_size, format, activity_latest_ms,
       detail_mtime_ms, detail_size
FROM sessions`

/**
 * A condition on the stored row: its detail was scanned from the source state
 * an upsert brings, at the same format. A detail can be archived ahead of the
 * list item, and a too-large one keeps its state with no detail, so both stay
 * through an update to that state.
 */
const STORED_DETAIL_MATCHES_UPSERT = `
  sessions.format = excluded.format
  AND sessions.detail_mtime_ms = excluded.source_mtime_ms
  AND sessions.detail_size = excluded.source_size`

/** An update keeps the stored detail only when it matches the new source state, and clears it otherwise. */
export const UPSERT_LIST_ITEM = `
INSERT INTO sessions (project_dir, session_id, source_mtime_ms, source_size, format,
  activity_latest_ms, list_item, archived_at_ms)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (project_dir, session_id) DO UPDATE SET
  source_mtime_ms = excluded.source_mtime_ms,
  source_size = excluded.source_size,
  activity_latest_ms = excluded.activity_latest_ms,
  list_item = excluded.list_item,
  detail = CASE WHEN ${STORED_DETAIL_MATCHES_UPSERT} THEN sessions.detail END,
  detail_mtime_ms = CASE WHEN ${STORED_DETAIL_MATCHES_UPSERT} THEN sessions.detail_mtime_ms END,
  detail_size = CASE WHEN ${STORED_DETAIL_MATCHES_UPSERT} THEN sessions.detail_size END,
  format = excluded.format,
  archived_at_ms = excluded.archived_at_ms
WHERE excluded.source_mtime_ms != sessions.source_mtime_ms
  OR excluded.source_size != sessions.source_size
  OR sessions.format != excluded.format`

export const UPDATE_DETAIL = `
UPDATE sessions SET detail = ?, detail_mtime_ms = ?, detail_size = ?
WHERE project_dir = ? AND session_id = ?`

export const SELECT_LIST_ITEM = `
SELECT list_item FROM sessions
WHERE project_dir = ? AND session_id = ? AND format = ?`

export const SELECT_DETAIL = `
SELECT detail FROM sessions
WHERE project_dir = ? AND session_id = ? AND format = ?`
