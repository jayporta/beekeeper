import { err, ok, type Result } from '../shared/result'
import { readBoundedJsonFile, type BoundedJsonErrorReason } from './readBoundedJsonFile'
import { subagentMetaSchema, type SubagentMeta } from './schemas'

/** The largest `.meta.json` file this reads. */
const MAX_META_BYTES = 64 * 1024

/**
 * Why a subagent's `.meta.json` couldn't be read into a valid
 * {@link SubagentMeta}.
 *
 * Every {@link BoundedJsonErrorReason} applies. A `symlink` is rejected
 * rather than followed since discovery already resolved real meta files, so
 * one appearing here means the path changed underneath it. `too-large` means
 * the file exceeds {@link MAX_META_BYTES}. `invalid-shape` is added for JSON
 * that parses but fails schema validation.
 */
export type SubagentMetaErrorReason = BoundedJsonErrorReason | 'invalid-shape'

/** Why {@link readSubagentMeta} could not produce a valid {@link SubagentMeta}. */
export interface SubagentMetaError {
  readonly reason: SubagentMetaErrorReason
}

/**
 * Reads and validates one subagent's `.meta.json` sidecar.
 *
 * Reads the file through {@link readBoundedJsonFile} with a
 * {@link MAX_META_BYTES} cap, then validates it against
 * {@link subagentMetaSchema}. A missing file, a symlink, a non-regular file,
 * an oversized one, invalid JSON, and JSON that fails the schema are all
 * reported as an {@link err} rather than thrown, since a subagent with no
 * usable meta still belongs in the agent tree, just parented to the lead.
 *
 * @param metaPath - Absolute path to the subagent's `.meta.json` file.
 * @returns `ok` with the validated meta, or an `err` describing why it
 * couldn't be read.
 * @throws {Error} When the file exists but can't be read for a reason
 * other than the ones above, such as a permissions error. Callers that
 * must isolate this failure to one subagent should catch it and capture
 * it as a `Result` (see `captureSystemError`).
 */
export async function readSubagentMeta(
  metaPath: string
): Promise<Result<SubagentMeta, SubagentMetaError>> {
  const raw = await readBoundedJsonFile(metaPath, MAX_META_BYTES)
  if (!raw.ok) return raw

  const result = subagentMetaSchema.safeParse(raw.value)
  return result.success ? ok(result.data) : err({ reason: 'invalid-shape' })
}
