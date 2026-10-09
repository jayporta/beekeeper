/** The archive store's SQL statements. */

/** Only the small columns, so the large text ones are never read. */
export const SELECT_STATES = `
SELECT project_dir, session_id, source_mtime_ms, source_size, format, activity_latest_ms,
       detail_mtime_ms, detail_size
FROM sessions`

/** An update clears the detail, since the source it was scanned from has changed. */
export const UPSERT_LIST_ITEM = `
INSERT INTO sessions (project_dir, session_id, source_mtime_ms, source_size, format,
  activity_latest_ms, list_item, archived_at_ms)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (project_dir, session_id) DO UPDATE SET
  source_mtime_ms = excluded.source_mtime_ms,
  source_size = excluded.source_size,
  activity_latest_ms = excluded.activity_latest_ms,
  list_item = excluded.list_item,
  detail = NULL,
  detail_mtime_ms = NULL,
  detail_size = NULL,
  format = excluded.format,
  archived_at_ms = excluded.archived_at_ms
WHERE excluded.source_mtime_ms != sessions.source_mtime_ms
  OR excluded.source_size != sessions.source_size
  OR sessions.format != excluded.format`

export const UPDATE_DETAIL = `
UPDATE sessions SET detail = ?, detail_mtime_ms = ?, detail_size = ?
WHERE project_dir = ? AND session_id = ?`
