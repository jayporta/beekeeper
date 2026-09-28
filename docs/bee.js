import { clamp, FULL_TURN, pickDestination, pickEdgeSpot, randomBetween } from './flightMath.js'
import { Posture } from './posture.js'
import { Shake } from './shake.js'
import { Trail } from './trail.js'

/** Range of top flight speeds, in pixels per second. */
const CRUISE_MIN = 170
const CRUISE_MAX = 250
/** How quickly a flying bee matches its desired velocity, per second. */
const STEER = 5
/** Distance from its destination where a bee starts slowing down. */
const ARRIVE_RADIUS = 70
/** Distance from its destination where a bee stops to hover. */
const ARRIVED_DISTANCE = 10
/** Largest sideways weave while flying, in radians. */
const WOBBLE = 1.1
/** Range of time a bee hovers in one spot, in seconds. */
const HOVER_MIN = 1.2
const HOVER_MAX = 3.5
/** How far a hovering bee drifts from its spot, in pixels. */
const HOVER_RADIUS = 8
const HOVER_SPRING = 10
const HOVER_DAMPING = 3.5
/** Slowest speed while flying, so the last stretch of a trip doesn't drag. */
const MIN_FLYING_SPEED = 40
/** Wing beat, in radians per second. */
const WING_RATE = 55
/** A bee sent to the lineup flies faster and weaves less. */
const PARKING_SPEEDUP = 1.4
const PARKING_WOBBLE = 0.3
/** How quickly a parked bee glides to a new spot in the lineup, per second. */
const GLIDE_EASE = 8
/** Distance from a bee's center that still counts as pointing at it. */
const HIT_RADIUS = 22

/**
 * One bee that flies from spot to spot, hovering at each one for a moment, and remembers where
 * it has been. A caught bee flies to its spot in the lineup and freezes there until released.
 */
export class Bee {
  /**
   * Creates a bee hovering in place.
   * @param {{ x: number, y: number, facing: 1 | -1 }} start - Starting position in CSS pixels, and whether the bee faces right (1) or left (-1).
   */
  constructor({ x, y, facing }) {
    this.x = x
    this.y = y
    this.posture = new Posture(facing)
    this.vx = 0
    this.vy = 0
    this.cruise = randomBetween(CRUISE_MIN, CRUISE_MAX)
    this.wingPhase = Math.random() * FULL_TURN
    this.wobble = 0
    this.wobbleTime = 0
    this.shaking = new Shake()
    /** When the bee appeared, from `performance.now()`. */
    this.spawnedAt = performance.now()
    /** When the bee froze in the lineup, from `performance.now()`, or `null` while it flies. */
    this.pausedAt = null
    this.trail = new Trail({ x, y })
    this.#hoverAt({ x, y })
  }

  /**
   * Creates a bee just inside a random edge, already flying toward a spot on the page.
   * @param {{ width: number, height: number }} bounds - The area the bee flies in.
   * @returns {Bee} The new bee.
   */
  static fromEdge(bounds) {
    const spot = pickEdgeSpot(bounds)
    const destination = pickDestination(bounds, spot)
    const heading = Math.atan2(destination.y - spot.y, destination.x - spot.x)
    const bee = new Bee({ ...spot, facing: destination.x < spot.x ? -1 : 1 })
    bee.vx = Math.cos(heading) * bee.cruise * 0.5
    bee.vy = Math.sin(heading) * bee.cruise * 0.5
    bee.#flyTo(destination)
    return bee
  }

  /**
   * Moves the bee by one frame: hovering around its spot, flying to the next one, or gliding
   * into its spot in the lineup.
   * @param {number} dt - Seconds since the last frame.
   * @param {{ width: number, height: number }} bounds - The area the bee flies in.
   */
  update(dt, bounds) {
    this.shaking.update(dt)
    if (this.mode === 'parked') {
      this.#glide(dt)
      this.#face(dt)
      return
    }
    this.wobbleTime -= dt
    if (this.mode === 'hover') this.#hover(dt, bounds)
    else this.#travel(dt)

    this.x += this.vx * dt
    this.y += this.vy * dt
    this.keepInside(bounds)
    this.#face(dt)
    this.wingPhase += WING_RATE * dt
    this.trail.record(this)
  }

  /**
   * Pulls the bee and its destination back inside the bounds, such as after the window shrinks.
   * @param {{ width: number, height: number }} bounds - The area the bee flies in.
   */
  keepInside({ width, height }) {
    const across = { min: 0, max: width }
    const down = { min: 0, max: height }
    this.x = clamp(this.x, across)
    this.y = clamp(this.y, down)
    this.target.x = clamp(this.target.x, across)
    this.target.y = clamp(this.target.y, down)
  }

  /** Whether the bee has reached its spot in the lineup and frozen there. */
  get isParked() {
    return this.mode === 'parked'
  }

  /**
   * Checks whether a point is on the bee, for clicks and the pointer cursor.
   * @param {{ x: number, y: number }} point - A point in CSS pixels.
   * @returns {boolean} Whether the point is on the bee.
   */
  contains(point) {
    return Math.hypot(point.x - this.x, point.y - this.y) <= HIT_RADIUS
  }

  /**
   * Sends the bee to a spot in the lineup, or moves it there if it's already parked.
   * @param {{ x: number, y: number }} spot - The spot's center, in CSS pixels.
   */
  park(spot) {
    this.target = { ...spot }
    if (this.mode === 'parked') return
    this.mode = 'parking'
    this.wobbleTime = 0
  }

  /**
   * Unfreezes a parked bee and sends it off to a new spot on the page.
   * @param {{ width: number, height: number }} bounds - The area the bee flies in.
   */
  release(bounds) {
    this.pausedAt = null
    this.#flyTo(pickDestination(bounds, this))
  }

  /** Starts a short sideways shake. */
  shake() {
    this.shaking.start()
  }

  /**
   * Jumps a bee straight to its destination, for when motion is reduced. A bee in the lineup
   * lands in its spot facing right, and a released bee hovers where it lands.
   */
  snap() {
    if (this.mode === 'hover') return
    this.x = this.target.x
    this.y = this.target.y
    if (this.mode === 'parking') this.#freeze()
    if (this.mode === 'travel') this.#hoverAt(this.target)
    else this.posture.snapTo(1)
  }

  #freeze() {
    this.mode = 'parked'
    this.vx = 0
    this.vy = 0
    this.posture.facing = 1
    this.pausedAt = performance.now()
  }

  #glide(dt) {
    const ease = Math.min(1, GLIDE_EASE * dt)
    this.x += (this.target.x - this.x) * ease
    this.y += (this.target.y - this.y) * ease
  }

  #hoverAt(spot) {
    this.mode = 'hover'
    this.target = { ...spot }
    this.hoverOffset = { x: 0, y: 0 }
    this.modeTime = randomBetween(HOVER_MIN, HOVER_MAX)
    this.wobbleTime = 0
  }

  #flyTo(spot) {
    this.mode = 'travel'
    this.target = spot
    this.wobbleTime = 0
  }

  /** Springs toward a point near the hover spot that jumps around, so the bee jitters in place. */
  #hover(dt, bounds) {
    this.modeTime -= dt
    if (this.modeTime <= 0) {
      this.#flyTo(pickDestination(bounds, this))
      return
    }
    if (this.wobbleTime <= 0) {
      this.wobbleTime = randomBetween(0.15, 0.45)
      const angle = Math.random() * FULL_TURN
      const distance = Math.random() * HOVER_RADIUS
      this.hoverOffset = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }
    }
    const pullX = this.target.x + this.hoverOffset.x - this.x
    const pullY = this.target.y + this.hoverOffset.y - this.y
    this.vx += (pullX * HOVER_SPRING - this.vx * HOVER_DAMPING) * dt
    this.vy += (pullY * HOVER_SPRING - this.vy * HOVER_DAMPING) * dt
  }

  /**
   * Weaves toward the destination, slowing on approach. On arrival the bee hovers, or freezes if
   * the destination is its spot in the lineup.
   */
  #travel(dt) {
    const parking = this.mode === 'parking'
    const dx = this.target.x - this.x
    const dy = this.target.y - this.y
    const distance = Math.hypot(dx, dy)
    if (distance < ARRIVED_DISTANCE) {
      if (parking) this.#freeze()
      else this.#hoverAt(this.target)
      return
    }
    if (this.wobbleTime <= 0) {
      this.wobbleTime = randomBetween(0.2, 0.5)
      this.wobble = randomBetween(-WOBBLE, WOBBLE)
    }
    // The weave fades on approach so the bee can settle on its spot.
    const approach = Math.sqrt(Math.min(1, distance / ARRIVE_RADIUS))
    const wobble = parking ? this.wobble * PARKING_WOBBLE : this.wobble
    const cruise = parking ? this.cruise * PARKING_SPEEDUP : this.cruise
    const direction = Math.atan2(dy, dx) + wobble * approach
    const speed = Math.max(cruise * approach, MIN_FLYING_SPEED)
    const blend = Math.min(1, STEER * dt)
    this.vx += (Math.cos(direction) * speed - this.vx) * blend
    this.vy += (Math.sin(direction) * speed - this.vy) * blend
  }

  #face(dt) {
    const flying = this.mode === 'travel' || this.mode === 'parking'
    this.posture.update(dt, { vx: this.vx, vy: this.vy, flying })
  }
}
