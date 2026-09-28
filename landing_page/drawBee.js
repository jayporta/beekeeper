import { FULL_TURN } from './flightMath.js'

const DOT_RADIUS = 1.6
/**
 * The bee is drawn in profile facing right (+x), with y pointing down, in unscaled pixels.
 * The abdomen tips down toward its rear.
 */
const ABDOMEN = { x: -8, y: 2, radiusX: 10, radiusY: 8, tilt: -0.2 }
/** Abdomen bands in its own tilted frame, from the thorax back: `[x, width]`. */
const ABDOMEN_BLACK_BANDS = [
  [0.5, 10],
  [-6.5, 3.5]
]
/** Large round thorax, with a yellow collar between `COLLAR.x` and `COLLAR.x + COLLAR.width`. */
const THORAX = { x: 2, y: -1, radius: 7 }
const COLLAR = { x: 4, width: 3 }
/** Head hangs a little low in front of the thorax. */
const HEAD = { x: 9.5, y: 2.5, radiusX: 3.8, radiusY: 4.5 }
const EYE_SHINE = { x: 10.8, y: 1, radius: 1 }
/** Short elbowed antenna: base, elbow, and tip. */
const ANTENNA = [
  [11, -1],
  [13.5, -4.5],
  [16.5, -4]
]
/** Legs hanging below the body, front to back: hip, knee, and foot. */
const LEGS = [
  [
    [6, 4],
    [8, 8],
    [7.5, 10.5]
  ],
  [
    [2, 5.5],
    [3, 9.5],
    [1.5, 12]
  ],
  [
    [-3, 5],
    [-5, 9],
    [-8, 11]
  ]
]
/** Wings attach on top of the thorax and beat up and down while angled back. */
const WING_ROOT = { x: 1, y: -6 }
const WINGS = [
  { length: 12, width: 3, angle: Math.PI + 0.1 },
  { length: 18, width: 4.2, angle: Math.PI + 0.4 }
]
const WING_FLAP = 0.5
/** Drawing scale; the shapes above are in unscaled pixels. */
const BEE_SCALE = 1.25

/**
 * @typedef {object} BeeColors
 * @property {string} body - Yellow fur.
 * @property {string} stripe - Black fur and the head.
 * @property {string} wing - Wing fill.
 * @property {string} vein - Wing edges and veins.
 * @property {string} shine - Highlight on the eye.
 * @property {string} trail - Trail dots.
 * @property {string} outline - Body outlines, legs, and antennae, so they show on any page.
 */

/**
 * Draws a dotted trail that fades out toward its oldest dot.
 * @param {CanvasRenderingContext2D} context - The canvas to draw on.
 * @param {{ trail: { x: number, y: number }[], color: string }} options - Trail points, oldest first, and their color.
 */
export function drawTrail(context, { trail, color }) {
  context.fillStyle = color
  // The newest dot sits under the bee, so it's skipped.
  const visible = trail.length - 1
  for (let index = 0; index < visible; index++) {
    const point = trail[index]
    context.globalAlpha = ((index + 1) / visible) * 0.8
    context.beginPath()
    context.arc(point.x, point.y, DOT_RADIUS, 0, FULL_TURN)
    context.fill()
  }
  context.globalAlpha = 1
}

/**
 * Draws a bumblebee in side profile, facing left or right and tilted toward where it's flying.
 * @param {CanvasRenderingContext2D} context - The canvas to draw on.
 * @param {{ bee: import('./bee.js').Bee, colors: BeeColors }} options - The bee and its colors.
 */
export function drawBee(context, { bee, colors }) {
  context.save()
  context.translate(bee.x + bee.shaking.offset, bee.y)
  context.scale(bee.posture.turn * BEE_SCALE, BEE_SCALE)
  context.rotate(bee.posture.pitch)
  context.strokeStyle = colors.outline
  context.lineWidth = 1
  context.lineCap = 'round'
  context.lineJoin = 'round'
  drawLimbs(context)
  drawAbdomen(context, colors)
  drawThorax(context, colors)
  drawHead(context, colors)
  drawWings(context, { flap: Math.sin(bee.wingPhase), colors })
  context.restore()
}

function strokePath(context, points) {
  context.beginPath()
  for (const [x, y] of points) context.lineTo(x, y)
  context.stroke()
}

function drawLimbs(context) {
  context.lineWidth = 1.4
  for (const leg of LEGS) strokePath(context, leg)
  context.lineWidth = 1
  strokePath(context, ANTENNA)
}

function drawAbdomen(context, colors) {
  context.save()
  context.translate(ABDOMEN.x, ABDOMEN.y)
  context.rotate(ABDOMEN.tilt)
  context.beginPath()
  context.ellipse(0, 0, ABDOMEN.radiusX, ABDOMEN.radiusY, 0, 0, FULL_TURN)
  context.fillStyle = colors.body
  context.fill()
  context.save()
  context.clip()
  context.fillStyle = colors.stripe
  for (const [x, width] of ABDOMEN_BLACK_BANDS) {
    context.fillRect(x, -ABDOMEN.radiusY, width, ABDOMEN.radiusY * 2)
  }
  context.restore()
  context.stroke()
  context.restore()
}

function drawThorax(context, colors) {
  context.beginPath()
  context.arc(THORAX.x, THORAX.y, THORAX.radius, 0, FULL_TURN)
  context.fillStyle = colors.stripe
  context.fill()
  context.save()
  context.clip()
  context.fillStyle = colors.body
  context.fillRect(COLLAR.x, THORAX.y - THORAX.radius, COLLAR.width, THORAX.radius * 2)
  context.restore()
  context.stroke()
}

function drawHead(context, colors) {
  context.beginPath()
  context.ellipse(HEAD.x, HEAD.y, HEAD.radiusX, HEAD.radiusY, 0, 0, FULL_TURN)
  context.fillStyle = colors.stripe
  context.fill()
  context.stroke()
  context.beginPath()
  context.arc(EYE_SHINE.x, EYE_SHINE.y, EYE_SHINE.radius, 0, FULL_TURN)
  context.fillStyle = colors.shine
  context.fill()
}

function drawWings(context, { flap, colors }) {
  context.fillStyle = colors.wing
  context.strokeStyle = colors.vein
  context.lineWidth = 0.75
  for (const wing of WINGS) {
    context.save()
    context.translate(WING_ROOT.x, WING_ROOT.y)
    context.rotate(wing.angle + flap * WING_FLAP)
    context.beginPath()
    context.ellipse(wing.length / 2, 0, wing.length / 2, wing.width, 0, 0, FULL_TURN)
    context.fill()
    context.stroke()
    // One vein running close to the leading edge.
    context.beginPath()
    context.moveTo(1, wing.width * 0.2)
    context.quadraticCurveTo(
      wing.length * 0.45,
      wing.width * 0.75,
      wing.length * 0.85,
      wing.width * 0.2
    )
    context.stroke()
    context.restore()
  }
}
