/** Converts one sRGB channel (0-255) to its linear value, per WCAG 2.x. */
function linearChannel(value: number): number {
  const scaled = value / 255
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (match === null) throw new Error(`Not a 6-digit hex color: ${hex}`)
  const [red = 0, green = 0, blue = 0] = match
    .slice(1)
    .map((pair) => linearChannel(parseInt(pair, 16)))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/**
 * Computes the WCAG 2.x contrast ratio between two opaque colors.
 *
 * @param foreground - A 6-digit hex color such as `#1d1f20`.
 * @param background - A 6-digit hex color.
 * @returns A ratio from 1 to 21, unrounded.
 * @throws {Error} When either color is not a 6-digit hex value.
 */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a
  )
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}
