import { z } from 'zod'

/** An OTLP/JSON `AnyValue`, reduced to the scalar shapes beekeeper reads. */
export interface OtlpValue {
  /** A string value. */
  readonly stringValue?: string
  /** An integer, which OTLP JSON sends as a number or, for 64-bit values, a string. */
  readonly intValue?: number | string
  /** A floating-point value. */
  readonly doubleValue?: number
}

/** Attribute values by key, limited to the keys the caller asked for. */
export type OtlpAttributes = ReadonlyMap<string, OtlpValue>

/** `z.number()` rejects non-finite numbers, so a number that parses is always finite. */
const valueSchema = z.object({
  stringValue: z.string().optional().catch(undefined),
  intValue: z.union([z.number(), z.string()]).optional().catch(undefined),
  doubleValue: z.number().optional().catch(undefined)
})

const attributeSchema = z.object({ key: z.string(), value: valueSchema })

/**
 * A plain decimal number, so `0x10`, `Infinity` and the empty string never
 * coerce. Each digit run has one way to match, so a long run of digits that
 * ends in a letter fails in linear time.
 */
const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/

function isWantedEntry(entry: unknown, wanted: ReadonlySet<string>): boolean {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'key' in entry &&
    typeof entry.key === 'string' &&
    wanted.has(entry.key)
  )
}

/**
 * Collects the wanted attributes from an OTLP attribute list. A malformed
 * entry is skipped, and keys outside `wanted` are never retained, so content
 * attributes such as prompts are dropped without being read.
 *
 * @param list - The `attributes` field of a resource or log record.
 * @param wanted - The attribute keys to keep.
 * @returns The kept attributes by key. A repeated key keeps its last value.
 */
export function collectOtlpAttributes(list: unknown, wanted: ReadonlySet<string>): OtlpAttributes {
  const attributes = new Map<string, OtlpValue>()
  if (!Array.isArray(list)) return attributes
  for (const entry of list as readonly unknown[]) {
    // Checked before the parse, so an attribute nobody asked for costs one lookup.
    if (!isWantedEntry(entry, wanted)) continue
    const parsed = attributeSchema.safeParse(entry)
    if (parsed.success) attributes.set(parsed.data.key, parsed.data.value)
  }
  return attributes
}

/**
 * Reads a number from a value sent as a `doubleValue`, an `intValue` (number
 * or numeric string), or a numeric `stringValue`.
 *
 * @param value - The attribute value, if present.
 * @returns A finite number, or `undefined` when the value is absent or isn't a number.
 */
export function readOtlpNumber(value: OtlpValue | undefined): number | undefined {
  if (value === undefined) return undefined
  const raw = value.doubleValue ?? value.intValue ?? value.stringValue
  if (typeof raw === 'number') return raw
  if (raw === undefined) return undefined
  const text = raw.trim()
  if (!DECIMAL.test(text)) return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Reads a string from an attribute's `stringValue`.
 *
 * @param value - The attribute value, if present.
 * @returns The string, or `undefined` when absent.
 */
export function readOtlpString(value: OtlpValue | undefined): string | undefined {
  return value?.stringValue
}
