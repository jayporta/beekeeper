import { z } from 'zod'
import pricesJson from './prices.json'
import { tokenClasses } from './tokenClasses'

/**
 * Prices for one billing speed, in USD per million tokens. Requires every
 * class in {@link tokenClasses}, no more and no fewer, so a price entry
 * can never omit or add a class silently.
 */
const priceEntrySchema = z.record(z.enum(tokenClasses), z.number())

/** A validated per-class price entry. */
export type PriceEntry = z.infer<typeof priceEntrySchema>

/** The billing speeds prices.json carries a price entry for. */
export const pricedSpeeds = ['standard'] as const

/** One of the billing speeds in {@link pricedSpeeds}. */
export type PricedSpeed = (typeof pricedSpeeds)[number]

/**
 * One model's prices. Requires every speed in {@link pricedSpeeds}, so a
 * speed can never exist in one without the other.
 */
const modelPricesSchema = z.record(z.enum(pricedSpeeds), priceEntrySchema)

/** A validated model's prices, by billing speed. */
export type ModelPrices = z.infer<typeof modelPricesSchema>

/** The shape of prices.json: a source citation, an as-of date, and prices by normalized model id. */
const priceTableSchema = z.object({
  source: z.string(),
  asOf: z.string(),
  models: z.record(z.string(), modelPricesSchema)
})

/** A validated price table. */
export type PriceTable = z.infer<typeof priceTableSchema>

/**
 * Validates a raw value as a price table.
 * @param raw - The parsed JSON to validate, such as the bundled prices.json.
 * @returns The validated price table.
 * @throws {Error} When `raw` doesn't match {@link priceTableSchema}.
 */
export function parsePriceTable(raw: unknown): PriceTable {
  const parsed = priceTableSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid pricing data: ${parsed.error.message}`)
  }
  return parsed.data
}

/** The app's bundled model price table, validated once at module load. */
export const priceTable: PriceTable = parsePriceTable(pricesJson)

/**
 * The bundled price table's models, keyed by normalized model id in a
 * `Map` rather than a plain object, so looking up an untrusted model id
 * (e.g. `constructor` or `toString`) can never resolve to an inherited
 * `Object.prototype` property instead of `undefined`.
 */
export const priceTableModels: ReadonlyMap<string, ModelPrices> = new Map(
  Object.entries(priceTable.models)
)
