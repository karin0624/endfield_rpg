type RGB = readonly [number, number, number];

// WCAG's unrounded sRGB luminance formula; this helper does not sample antialiased pixels.
function luminance(rgb: RGB): number {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

/** A sufficient lower bound for opaque text over one source-over plate and dark/colored shadows. */
export function plateContrastLowerBound(foreground: RGB, plate: RGB, alpha: number, shadows: readonly RGB[] = []) {
  const lower = plate.map((channel, i) =>
    Math.min(channel * alpha, ...shadows.map((color) => color[i])),
  ) as unknown as RGB;
  const upper = plate.map((channel, i) =>
    Math.max(channel * alpha + 255 * (1 - alpha), ...shadows.map((color) => color[i])),
  ) as unknown as RGB;
  const fg = luminance(foreground);
  const low = luminance(lower);
  const high = luminance(upper);
  // Every source-over mixture stays within the channel ranges; luminance is monotonic.
  if (fg >= low && fg <= high) return 1;
  const nearest = fg < low ? low : high;
  return (Math.max(fg, nearest) + 0.05) / (Math.min(fg, nearest) + 0.05);
}
