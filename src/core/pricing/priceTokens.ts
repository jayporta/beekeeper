import { normalizeModelId } from './normalizeModelId'
import { pricedSpeeds, priceTableModels, type PricedSpeed } from './priceTable'
import { tokenClasses } from './tokenClasses'
import type { TokenCounts } from './tokenCounts'

const pricedSpeedSet: ReadonlySet<string> = new Set(pricedSpeeds)

const SYNTHETIC_MODEL_ID = '<synthetic>'

/** Options for {@link priceTokens}. */
export interface PriceTokensOptions {
  /** Model id exactly as it appears in the transcript, before normalization. */
  model: string
  /** Billing speed as read from the transcript's usage; `undefined` or `null` means standard. */
  speed: unknown
  /** Token counts to price. */
  tokens: TokenCounts
}

/** A successful price lookup. */
export interface PricedTokens {
  /** Discriminant for {@link PriceTokensResult}. */
  kind: 'priced'
  /** The price of `tokens`, in US dollars. */
  usd: number
}

/** A model or speed with no known price. */
export interface UnpricedTokens {
  /** Discriminant for {@link PriceTokensResult}. */
  kind: 'unpriced'
  /** Why no price could be found. */
  reason: 'unknown-model' | 'unknown-speed'
}

/** A model that is never billed, such as the synthetic placeholder model. */
export interface FreeTokens {
  /** Discriminant for {@link PriceTokensResult}. */
  kind: 'free'
}

/** The outcome of pricing one usage snapshot. */
export type PriceTokensResult = PricedTokens | UnpricedTokens | FreeTokens

/**
 * Prices one usage snapshot's token counts against the bundled price table.
 * @param options - The raw model id, transcript speed, and token counts to price.
 * @returns `{ kind: 'priced' }` with the USD cost, `{ kind: 'unpriced' }` when
 * the model or speed has no known price, or `{ kind: 'free' }` for the
 * synthetic placeholder model. An unknown model is never priced at $0.
 */
export function priceTokens(options: PriceTokensOptions): PriceTokensResult {
  const { model, speed, tokens } = options

  if (model === SYNTHETIC_MODEL_ID) return { kind: 'free' }

  const modelPrices = priceTableModels.get(normalizeModelId(model))
  if (!modelPrices) return { kind: 'unpriced', reason: 'unknown-model' }

  const resolvedSpeed = resolveSpeed(speed)
  if (!resolvedSpeed) return { kind: 'unpriced', reason: 'unknown-speed' }

  const price = modelPrices[resolvedSpeed]
  const usd =
    tokenClasses.reduce((sum, tokenClass) => sum + tokens[tokenClass] * price[tokenClass], 0) /
    1_000_000
  return { kind: 'priced', usd }
}

/**
 * Resolves a transcript's raw `speed` value to a known billing speed.
 * @param speed - The raw speed value: `undefined`/`null` (standard), a
 * priced speed string, or anything else (unknown).
 * @returns The matching {@link PricedSpeed}, or `undefined` when unknown.
 */
function resolveSpeed(speed: unknown): PricedSpeed | undefined {
  if (speed === undefined || speed === null) return 'standard'
  if (typeof speed !== 'string') return undefined
  return isPricedSpeed(speed) ? speed : undefined
}

/**
 * Narrows a string to a {@link PricedSpeed} when the price table has an
 * entry for it.
 * @param speed - The candidate speed string.
 * @returns Whether `speed` is a known billing speed.
 */
function isPricedSpeed(speed: string): speed is PricedSpeed {
  return pricedSpeedSet.has(speed)
}
