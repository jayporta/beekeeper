/** One full turn, in radians. */
export const FULL_TURN = Math.PI * 2
/** Closest a destination can be to an edge. */
const EDGE_MARGIN = 60
/** Range of trip lengths between two hover spots. */
const MIN_TRIP = 180
const MAX_TRIP = 480
/** How far inside an edge a new bee appears. */
const SPAWN_INSET = 12

/**
 * Picks a random number in a range.
 * @param {number} min - Smallest possible value.
 * @param {number} max - Largest possible value.
 * @returns {number} A number from `min` up to `max`.
 */
export function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

/**
 * Limits a number to a range.
 * @param {number} value - The number to limit.
 * @param {{ min: number, max: number }} range - Smallest and largest allowed values.
 * @returns {number} `value`, moved into the range if it was outside it.
 */
export function clamp(value, { min, max }) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Picks a random spot to fly to, preferring one a moderate distance away.
 * @param {{ width: number, height: number }} bounds - The area the bee flies in.
 * @param {{ x: number, y: number }} from - Where the bee is now.
 * @returns {{ x: number, y: number }} The destination, away from the edges.
 */
export function pickDestination({ width, height }, from) {
  const smallest = Math.min(width, height)
  const margin = Math.min(EDGE_MARGIN, smallest * 0.15)
  const minTrip = Math.min(MIN_TRIP, smallest * 0.35)
  let spot = { x: width / 2, y: height / 2 }
  for (let attempt = 0; attempt < 8; attempt++) {
    spot = { x: randomBetween(margin, width - margin), y: randomBetween(margin, height - margin) }
    const trip = Math.hypot(spot.x - from.x, spot.y - from.y)
    if (trip >= minTrip && trip <= MAX_TRIP) break
  }
  return spot
}

/**
 * Picks a random spot just inside one of the four edges, for a new bee to fly in from.
 * @param {{ width: number, height: number }} bounds - The area the bee flies in.
 * @returns {{ x: number, y: number }} The spot, in CSS pixels.
 */
export function pickEdgeSpot({ width, height }) {
  const spots = [
    { x: SPAWN_INSET, y: Math.random() * height },
    { x: width - SPAWN_INSET, y: Math.random() * height },
    { x: Math.random() * width, y: SPAWN_INSET },
    { x: Math.random() * width, y: height - SPAWN_INSET }
  ]
  return spots[Math.floor(Math.random() * spots.length)]
}
