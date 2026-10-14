import { clamp } from './flightMath.js'

/** Slowest speed at which a bee turns to face where it's going, or tilts toward it. */
const FACING_SPEED = 30
/** How fast a bee turns around, in facings per second (a full turn is 2). */
const TURN_RATE = 8
/** Steepest nose-up or nose-down tilt, in radians. */
const MAX_PITCH = 0.45
const PITCH_EASE = 6

/** Which way a bee in side profile faces, and how far its nose tilts up or down. */
export class Posture {
  /**
   * @param {1 | -1} facing - Whether the bee starts facing right (1) or left (-1).
   */
  constructor(facing) {
    this.facing = facing
    /** Horizontal scale while drawing: eases between -1 and 1 as the bee turns around. */
    this.turn = facing
    /** Nose tilt in radians; positive is nose down. */
    this.pitch = 0
  }

  /**
   * Faces a direction right away, level, without easing into it.
   * @param {1 | -1} facing - Right (1) or left (-1).
   */
  snapTo(facing) {
    this.facing = facing
    this.turn = facing
    this.pitch = 0
  }

  /**
   * Turns toward the direction of flight and tilts the nose toward climbs and dives. A bee that
   * isn't flying keeps its facing, so hover jitter doesn't flip it back and forth.
   * @param {number} dt - Seconds since the last frame.
   * @param {{ vx: number, vy: number, flying: boolean }} motion - The bee's velocity in pixels per second, and whether it's flying somewhere.
   */
  update(dt, { vx, vy, flying }) {
    if (flying && Math.abs(vx) > FACING_SPEED) this.facing = Math.sign(vx)
    const step = TURN_RATE * dt
    this.turn += clamp(this.facing - this.turn, { min: -step, max: step })

    const moving = Math.hypot(vx, vy) > FACING_SPEED
    const slope = Math.atan2(vy, Math.abs(vx))
    const targetPitch = moving ? clamp(slope, { min: -MAX_PITCH, max: MAX_PITCH }) : 0
    this.pitch += (targetPitch - this.pitch) * Math.min(1, PITCH_EASE * dt)
  }
}
