import { z } from 'zod'
import { err, ok, type Result } from '../../core/shared/result'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import { archivedDetailSchema } from './archivedDetailSchema'
import { archivedListItemSchema } from './archivedListItemSchema'

/** Why a stored row can't be served: bad JSON, a shape the UI can't rely on, or keys that don't match the row's. */
export type ArchivedRowError = 'invalid-json' | 'invalid-shape' | 'key-mismatch'

/** What {@link parseRow} checks a row's JSON against. */
interface ParseRowOptions<Schema extends z.ZodType> {
  /** The row's stored JSON. */
  readonly json: string
  /** The shape the UI relies on. */
  readonly schema: Schema
  /** Whether the parsed value carries the row's own keys. */
  readonly matchesKey: (parsed: z.output<Schema>) => boolean
}

/** Parses stored JSON, then checks it against a schema and the keys of its row. */
function parseRow<Schema extends z.ZodType, Dto>(
  options: ParseRowOptions<Schema>
): Result<Dto, ArchivedRowError> {
  let value: unknown
  try {
    value = JSON.parse(options.json)
  } catch {
    return err('invalid-json')
  }
  const parsed = options.schema.safeParse(value)
  if (!parsed.success) return err('invalid-shape')
  if (!options.matchesKey(parsed.data)) return err('key-mismatch')
  // The row was written from this DTO by this app. The shape check above covers
  // the fields the UI reads without a guard, and the format version guards against drift.
  return ok(value as Dto)
}

/**
 * Reads an archived list item back from the JSON a row holds.
 *
 * @param json - The row's `list_item` column.
 * @param ref - The row's keys, which the item must carry.
 * @returns The list item, or why the row can't be served.
 */
export function parseArchivedListItem(
  json: string,
  ref: SessionRefDto
): Result<SessionListItemDto, ArchivedRowError> {
  return parseRow({
    json,
    schema: archivedListItemSchema,
    matchesKey: (item) =>
      item.projectDirName === ref.projectDirName && item.sessionId === ref.sessionId
  })
}

/**
 * Reads an archived session detail back from the JSON a row holds.
 *
 * @param json - The row's `detail` column.
 * @param ref - The row's keys. The detail carries the session id only.
 * @returns The detail, or why the row can't be served.
 */
export function parseArchivedDetail(
  json: string,
  ref: SessionRefDto
): Result<SessionDetailDto, ArchivedRowError> {
  return parseRow({
    json,
    schema: archivedDetailSchema,
    matchesKey: (detail) => detail.sessionId === ref.sessionId
  })
}
