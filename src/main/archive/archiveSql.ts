/** The archive store's SQL statements. */

/** Only the small columns, so the large text ones are never read. */
export const SELECT_STATES = `
SELECT project_dir, session_id, source_mtime_ms, source_size, format, activity_latest_ms,
       detail_mtime_ms, detail_size
FROM sessions`

/** In an update, every right-hand side reads the old row, so `sessions.format` is the stored format. */
export const UPSERT_LIST_ITEM = `
INSERT INTO sessions (project_dir, session_id, source_mtime_ms, source_size, format,
  activity_latest_ms, list_item, archived_at_ms)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (project_dir, session_id) DO UPDATE SET
  source_mtime_ms = excluded.source_mtime_ms,
  source_size = excluded.source_size,
  activity_latest_ms = excluded.activity_latest_ms,
  list_item = excluded.list_item,
  detail = CASE WHEN sessions.format = excluded.format THEN sessions.detail END,
  detail_mtime_ms = CASE WHEN sessions.format = excluded.format THEN sessions.detail_mtime_ms END,
  detail_size = CASE WHEN sessions.format = excluded.format THEN sessions.detail_size END,
  format = excluded.format,
  archived_at_ms = excluded.archived_at_ms
WHERE excluded.source_mtime_ms != sessions.source_mtime_ms
  OR excluded.source_size != sessions.source_size
  OR sessions.format != excluded.format`

export const UPDATE_DETAIL = `
UPDATE sessions SET detail = ?, detail_mtime_ms = ?, detail_size = ?
WHERE project_dir = ? AND session_id = ?`
