import { describe, expect, it } from 'vitest'
import {
  MAX_SCALE,
  MIN_SCALE,
  ZOOM_STEP,
  clampScale,
  fitScale,
  scaleAfterWheel,
  stepScale
} from '../graphZoom'

describe('the scale limits', () => {
  it('run from a quarter size to double size', () => {
    expect([MIN_SCALE, MAX_SCALE]).toEqual([0.25, 2])
  })
})

describe('clampScale', () => {
  it('keeps a scale in range', () => {
    expect(clampScale(1)).toBe(1)
  })

  it('raises a scale below the minimum to it', () => {
    expect(clampScale(0.01)).toBe(MIN_SCALE)
  })

  it('lowers a scale above the maximum to it', () => {
    expect(clampScale(50)).toBe(MAX_SCALE)
  })

  it('allows the limits themselves', () => {
    expect([clampScale(MIN_SCALE), clampScale(MAX_SCALE)]).toEqual([MIN_SCALE, MAX_SCALE])
  })
})

describe('stepScale', () => {
  it('zooms in by the step and out by the same step', () => {
    expect(stepScale(1, 'in')).toBeCloseTo(ZOOM_STEP)
    expect(stepScale(1, 'out')).toBeCloseTo(1 / ZOOM_STEP)
  })

  it('stops at the maximum and at the minimum', () => {
    expect(stepScale(MAX_SCALE, 'in')).toBe(MAX_SCALE)
    expect(stepScale(MIN_SCALE, 'out')).toBe(MIN_SCALE)
  })
})

describe('scaleAfterWheel', () => {
  it('zooms in when the wheel turns up and out when it turns down', () => {
    expect(scaleAfterWheel(1, -100)).toBeGreaterThan(1)
    expect(scaleAfterWheel(1, 100)).toBeLessThan(1)
  })

  it('zooms more for a bigger turn', () => {
    expect(scaleAfterWheel(1, -200)).toBeGreaterThan(scaleAfterWheel(1, -50))
  })

  it('stays put when the wheel does not turn', () => {
    expect(scaleAfterWheel(1.5, 0)).toBe(1.5)
  })

  it('stays in range however far it turns', () => {
    expect(scaleAfterWheel(1, -1e6)).toBe(MAX_SCALE)
    expect(scaleAfterWheel(1, 1e6)).toBe(MIN_SCALE)
  })
})

describe('fitScale', () => {
  it('fits a graph wider than the view by its width', () => {
    expect(fitScale({ width: 1000, height: 100 }, { width: 500, height: 800 })).toBe(0.5)
  })

  it('fits a graph taller than the view by its height', () => {
    expect(fitScale({ width: 100, height: 1000 }, { width: 800, height: 400 })).toBe(0.4)
  })

  it('fits by whichever side is tighter', () => {
    expect(fitScale({ width: 1000, height: 1000 }, { width: 500, height: 250 })).toBe(0.25)
  })

  it('does not magnify a graph that already fits', () => {
    expect(fitScale({ width: 100, height: 100 }, { width: 800, height: 800 })).toBe(1)
  })

  it('does not go below the minimum for a huge graph', () => {
    expect(fitScale({ width: 1e6, height: 1e6 }, { width: 100, height: 100 })).toBe(MIN_SCALE)
  })

  it('is null when the view has no size to fit into', () => {
    expect(fitScale({ width: 100, height: 100 }, { width: 0, height: 400 })).toBeNull()
    expect(fitScale({ width: 100, height: 100 }, { width: 400, height: 0 })).toBeNull()
  })
})
