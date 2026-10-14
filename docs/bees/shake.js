/** Length of a shake in seconds. */
const SHAKE_DURATION = 0.4
/** Shake speed in radians per second. */
const SHAKE_RATE = 90
/** Widest sideways offset in pixels, at the start of a shake. */
const SHAKE_WIDTH = 3

/** A short sideways shake that fades out, for when a bee is clicked. */
export class Shake {
  constructor() {
    this.time = 0
    /** Sideways offset in pixels to draw with, not part of the bee's position. */
    this.offset = 0
  }

  /** Starts the shake over from full strength. */
  start() {
    this.time = SHAKE_DURATION
  }

  /**
   * Advances the shake by one frame.
   * @param {number} dt - Seconds since the last frame.
   */
  update(dt) {
    this.time = Math.max(0, this.time - dt)
    const strength = this.time / SHAKE_DURATION
    this.offset = Math.sin(this.time * SHAKE_RATE) * SHAKE_WIDTH * strength
  }
}
